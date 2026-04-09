# AI 小说生成器核心生产闭环补完设计

## 1. 目标

本设计用于补完当前项目中“主生产链只有 workflow 骨架、没有真实执行闭环”的缺口，使系统达到单机可上线前的核心业务基线。

本子项目完成后，系统应能够从一个已创建的小说项目出发，真实执行以下链路：

- 生成总纲
- 生成分部计划
- 生成下一章计划
- 生成章节草稿
- 审核与有限次自动改写
- 将章节推进到 `approved` 或 `blocked_for_manual_decision`
- 为后续决策链留下明确、可持久化的阻塞触发点

同时，系统必须真实写入 `StoryState`、`ChapterPlan`、`ChapterDraft`、`ReviewOutcome`、`AgentRun`、`WorkflowRun`、`StepRun` 等关键数据，而不再只是返回排队元数据或标记假成功。

## 2. 范围

### 2.1 本子项目包含

- `generate-outline-flow` 的真实执行闭环
- `generate-volume-flow` 的真实执行闭环
- `generate-chapter-flow` 的真实执行闭环
- `review-rewrite-flow` 的真实执行闭环
- worker 中的真实 step 执行框架
- `agent-runtime` 与 workflow 的真实接线
- 主生产链相关 repository 的真实副作用落库
- 项目级章节流水线锁
- 决策阻塞触发点的持久化边界
- 单元、集成、smoke 测试补强

### 2.2 本子项目不包含

- 真实多轮 `DecisionSession` 对话
- `DecisionResolution` 应用与 recovery window 恢复
- publish task fan-out
- manual export 批量导出执行链
- docker compose、环境变量、部署手册等生产部署收尾
- 真实外部平台发布

## 3. 问题定义

当前代码已经具备：

- Phase 2 到 Phase 4 的 domain 类型
- workflow 定义
- API 触发入口
- worker job 入口
- storage repository 骨架
- agent runtime 骨架

但主生产链并未真正闭环：

1. workflow runner 只记录 `StepRun` 成功，不执行任何业务逻辑。
2. story production API 只创建 `WorkflowRun` 并返回排队形状。
3. worker 不会真实调用 agent、也不会更新故事状态。
4. review/rewrite 只存在 step 名字，没有真正的审核闭环。
5. `blocked_for_manual_decision` 只是状态名，不是清晰的持久化触发边界。

因此，当前系统还不能承担真实内容生产任务，也不具备单机上线前最基本的业务可用性。

## 4. 设计原则

1. 先补齐真实业务闭环，再扩展后续决策与发布链路。
2. workflow 负责编排，executor 负责执行，repository 负责持久化，边界必须清晰。
3. 所有模型调用必须经过统一 `agent-runtime`，不得在 workflow 中手写协议细节。
4. 任何 step 失败都必须显式落到 `StepRun` / `WorkflowRun` 和 `AgentRun`。
5. 主生产链的每一步都必须可重放、可审计、可定位失败点。
6. 本子项目只把章节推进到 `approved` 或 `blocked_for_manual_decision`，不在此阶段继续处理后续分支。

## 5. 总体架构

本子项目将当前“只有 step 名字的 workflow”升级为“可执行 workflow + typed step executors”。

### 5.1 包职责

#### `packages/workflows`

负责定义：

- 每条 flow 的步骤顺序
- 每个 step 的输入输出上下文类型
- flow 与 step executor 的绑定关系

`packages/workflows` 不直接操作数据库，也不直接拼接 HTTP 请求。

#### `apps/worker`

负责：

- 接收 job 名称和 payload
- 装配 workflow 执行依赖
- 顺序执行 step executor
- 在每一步前后更新 `StepRun`
- 在整条 flow 成功或失败时更新 `WorkflowRun`

worker 是主生产链的唯一真实执行入口。

#### `packages/agent-runtime`

负责：

- prompt 渲染
- capacity lease 获取与释放
- 模型调用
- 结构化输出解析与校验失败传播
- `AgentRun` 审计记录

workflow executor 只能通过 `agent-runtime` 调 agent。

#### `packages/storage`

负责：

- 所有故事状态和章节状态写入
- workflow run 与 step run 记录
- 生产链前置条件读取
- 决策阻塞点的持久化入口

repository 继续作为唯一持久化边界。

#### `apps/api`

负责：

- 触发 story production workflow
- 返回 run id 和基本排队信息
- 不直接承载 outline/volume/chapter/review 的业务执行

## 6. 执行模型

### 6.1 WorkflowDefinition

保留 flow definition 的概念，但从“纯字符串 step 列表”升级为可绑定 executor 的定义对象。

每条 flow 至少包含：

- `name`
- `steps`
- `buildInitialContext(payload)`

每个 step 至少包含：

- `name`
- `run(context, deps)`

### 6.2 Workflow Context

每条 flow 在运行时维护一个显式上下文对象，用于在 step 之间传递中间结果，例如：

- 项目
- prompt config
- story state
- 当前 chapter number
- chapter plan
- draft version
- review outcome

不允许通过隐式全局变量在 step 之间传递状态。

### 6.3 Workflow Runner

新的 runner 执行语义为：

1. 创建 `WorkflowRun`
2. 对每个 step：
   - 创建或标记 `StepRun` 为 `running`
   - 调用 step executor
   - 成功则标记 `succeeded`
   - 失败则标记 `failed`，并终止后续步骤
3. 若所有 step 成功，则 `WorkflowRun = succeeded`
4. 若任一步失败，则 `WorkflowRun = failed`

### 6.4 失败传播

step executor 内的任何错误都直接向上抛出，不做静默兜底。

runner 负责：

- 记录失败 step 的错误信息
- 记录整条 workflow 的错误信息
- 返回明确失败状态给 worker 调用者

## 7. 核心 Flow 设计

### 7.1 `generate-outline-flow`

步骤：

1. 读取 `NovelProject`
2. 读取 `outline-agent` prompt config
3. 执行 `outline-agent`
4. 校验结构化输出
5. 写入 `OutlineRecord`
6. 更新 `StoryState.outline`
7. 若输出带有 story bible，则同时更新 `StoryState.storyBible`
8. 记录 `AgentRun`

成功后：

- 项目具备后续 volume flow 的可消费 outline
- `WorkflowRun` 与 `AgentRun` 都可追溯

失败后：

- 不写 outline 相关状态
- `WorkflowRun` 与 `StepRun` 显式标记失败

### 7.2 `generate-volume-flow`

前置条件：

- 项目已存在 outline

步骤：

1. 读取已确认 outline
2. 读取 `volume-agent` prompt config
3. 执行 `volume-agent`
4. 校验结构化输出
5. 写入 `VolumePlanRecord[]`
6. 更新 `StoryState.volumePlans`
7. 初始化或更新 `StoryState.currentPosition`
8. 记录 `AgentRun`

成功后：

- 系统具备 chapter planning 的基础节奏信息

失败后：

- 不覆盖现有有效 volume plans

### 7.3 `generate-chapter-flow`

前置条件：

- 项目已有 outline
- 项目已有 volume plans
- 当前项目不存在其他活跃章节流水线

步骤：

1. 获取项目级章节流水线锁
2. 读取 `StoryState.currentPosition`
3. 计算下一章 `chapterNumber`
4. 读取 `chapter-plan-agent` prompt config
5. 执行 `chapter-plan-agent`
6. 校验结构化计划输出
7. 写入 `ChapterPlanRecord`
8. 更新 `ChapterState -> planned`
9. 读取 `chapter-draft-agent` prompt config
10. 执行 `chapter-draft-agent`
11. 写入 `ChapterDraftRecord(version=1)`
12. 更新 `ChapterState -> drafted`
13. 记录两次 `AgentRun`
14. 释放项目级锁

额外约束：

- `chapter-plan-agent` 和 `chapter-draft-agent` 必须各自独立审计
- `chapter-draft-agent` 不得默认注入全书正文

### 7.4 `review-rewrite-flow`

前置条件：

- 当前章至少存在一个 draft version

步骤：

1. 读取最新 draft
2. 读取 `review-agent` prompt config
3. 执行 `review-agent`
4. 写入 `ReviewOutcome`
5. 按 `decision` 分支：

#### `approve`

- 更新 `ChapterState -> approved`
- 生成本章 summary
- 回灌 `StoryState.chapterSummaries`
- 推进 `StoryState.currentPosition.nextChapterNumber`

#### `rewrite`

- 若当前 rewrite 次数小于 2：
  - 读取 `rewrite-agent` prompt config
  - 执行 `rewrite-agent`
  - 写入新 `ChapterDraftRecord(version=n+1)`
  - 再次进入 review
- 若当前 rewrite 次数已达到 2：
  - 更新 `ChapterState -> blocked_for_manual_decision`

#### `blocked_for_manual_decision`

- 更新 `ChapterState -> blocked_for_manual_decision`
- 创建明确的决策触发记录
- 在当前子项目中不继续进入真实决策对话

### 7.5 决策触发边界

本子项目不实现真实 `DecisionSession` 对话，但必须留下稳定的接入边界。

因此，当 review 产生阻塞结果时，系统至少需要：

- 记录章节阻塞状态
- 记录阻塞原因
- 生成后续可消费的决策触发数据

后续第二份 spec 将消费这条边界，接入真正的 `DecisionSession` 创建、消息流和 resolution/recovery。

## 8. Agent Runtime 接线

### 8.1 统一调用路径

所有写作与审核 agent 统一通过 `createAgentRunner(...)` 调用，不允许在 workflow step 中直接：

- 操作 provider lease
- 直接拼接 OpenAI-compatible HTTP 请求
- 直接写 `AgentRun`

### 8.2 输出解析

执行器需按 agent 类型区分输出约束：

- outline、volume、chapter-plan、review、rewrite 使用明确的 schema 解析器
- chapter-draft 可输出自由正文，但必须具备 metadata

若解析失败：

- 当前 step 立即失败
- `AgentRun.status = failed`
- 不做隐式 fallback

### 8.3 可测试运行模式

本子项目的验收基线为：

- 测试环境可使用 fake/stub model invocation 跑通全部业务副作用
- 运行时保留真实 `agent-runner + capacity lease + invokeModel` 的接线路径

也就是说：

- CI 不要求依赖真实外部模型
- 代码结构必须能够在后续接入真实 provider 时直接运行

## 9. 状态与持久化设计

### 9.1 `StoryState`

本子项目中真实维护：

- `storyBible`
- `outline`
- `volumePlans`
- `chapterSummaries`
- `currentPosition`

暂不强制在本子项目中补全：

- `confirmedFacts`
- `openForeshadowing`

但 executor 设计需保留后续扩展空间。

### 9.2 `ChapterState`

本子项目实际使用的状态：

- `planned`
- `drafted`
- `approved`
- `blocked_for_manual_decision`
- `failed`

如实现需要，也允许在中间步骤显式使用：

- `in_review`
- `needs_rewrite`

### 9.3 `ChapterDraftRecord`

必须支持多版本草稿。

规则：

- 首次生成正文时写入 `version=1`
- 每次 rewrite 产生新版本时按版本号递增
- review 始终读取当前最新版本

### 9.4 `ReviewOutcome`

每次 review 都写一条记录，不覆盖历史。

输出至少包含：

- `decision`
- `issues`
- `rewriteInstructions`
- `canAutoRewrite`
- `triggeredManualDecision`

### 9.5 `AgentRun`

每个 agent 调用都必须写 `AgentRun`，包括失败调用。

至少包含：

- 输入快照
- provider/model/apiKey/lease
- 原始输出
- 解析输出
- token usage
- 错误信息

### 9.6 `WorkflowRun` / `StepRun`

`WorkflowRun` 和 `StepRun` 必须从“假成功打点”升级为真实执行日志。

要求：

- step 失败时保存错误信息
- run 失败时保存错误信息
- step 顺序与实际执行顺序一致

## 10. 并发与锁

同一项目同一时刻只允许一个活跃章节流水线。

### 10.1 锁的目标

避免以下冲突：

- 两个 worker 同时生成同一“下一章”
- review 流程读取到被另一条链更新中的 chapter draft
- `currentPosition.nextChapterNumber` 被并发推进

### 10.2 锁的范围

锁只作用于 chapter pipeline：

- `generate-chapter-flow`
- 与其直接相连的 `review-rewrite-flow`

outline 和 volume flow 不使用该锁。

### 10.3 拿锁失败

若项目已存在活跃章节流水线：

- 当前请求直接失败
- `WorkflowRun` 标记 `failed`
- 错误信息必须明确指出是项目级章节流水线冲突

## 11. 错误处理

### 11.1 Step 失败

任一步失败时：

- 当前 `StepRun = failed`
- 当前 `WorkflowRun = failed`
- 错误信息写入 run 记录
- 后续 step 不再继续执行

### 11.2 跨步骤副作用

本子项目不做跨步骤数据库回滚。

原因：

- outline、volume、chapter、review 的业务本身就是阶段式持久化
- 一部分中间结果对排障和重试有价值
- 强行大事务会显著放大执行链耦合与失败面

因此策略是：

- 保留已成功步骤的落库结果
- 失败步骤及之后不写入

### 11.3 结构化输出失败

若 agent 输出无法解析或校验失败：

- 视为 step 失败
- 记录失败的 `AgentRun`
- 不写后续业务状态

### 11.4 Rewrite 阈值

自动 rewrite 最多 2 次。

若仍未通过：

- 当前章进入 `blocked_for_manual_decision`
- 不再继续自动 rewrite

### 11.5 前置条件失败

以下情况必须直接失败：

- outline 不存在时触发 volume
- outline 或 volume 缺失时触发 next chapter
- 当前章不存在 draft 时触发 review

错误信息必须可定位具体前置条件缺失。

## 12. 测试策略

### 12.1 单元测试

覆盖：

- step executor 的成功分支
- step executor 的失败分支
- chapter number 计算
- 锁冲突处理
- review/rewrite 2 次阈值
- schema parse failure

### 12.2 集成测试

覆盖：

- 从 API 触发 outline flow 后，真实写出 outline/story state/workflow run/agent run
- 从 API 触发 volume flow 后，真实写出 volume plans 和 current position
- 从 API 触发 next chapter flow 后，真实写出 chapter plan、draft、chapter state
- review approve 分支会回灌 summary 并推进 current position
- review blocked 分支会留下阻塞状态和决策触发数据

### 12.3 Smoke 测试

使用可控 fake model/provider 跑通：

1. create project
2. generate outline
3. generate volume
4. generate next chapter
5. review
6. 章节进入 `approved` 或 `blocked_for_manual_decision`

### 12.4 CI 边界

CI 不要求：

- 真实第三方模型调用
- 额外独立服务
- 真实发布平台连接器

CI 只要求用本地可控替身跑通业务副作用和状态流转。

## 13. 验收标准

本子项目完成时，必须满足：

1. `generate-outline-flow`、`generate-volume-flow`、`generate-chapter-flow`、`review-rewrite-flow` 都会真实执行，而不是只记录假成功 step。
2. 每个 flow 的关键业务结果都会真实落库。
3. 每次 agent 调用都会记录成功或失败的 `AgentRun`。
4. `WorkflowRun` / `StepRun` 能真实反映执行成功与失败。
5. 自动 rewrite 超过阈值时，章节会稳定进入 `blocked_for_manual_decision`。
6. 同一项目不会并发生成两条章节流水线。
7. 系统可以在 fake provider 环境下跑通从 outline 到 approved/blocked 的主生产链。

## 14. 与后续子项目的衔接

本设计完成后，将为后续两份 spec 提供稳定基础：

- `决策恢复闭环`
  - 消费本子项目产出的阻塞状态和决策触发边界
- `发布与部署收尾`
  - 消费本子项目产出的 approved chapters、workflow observability 和真实 agent 审计记录

换言之，本子项目的目标不是一次做完整个平台，而是先把“内容生产主链”提升到真实可运行、可观测、可继续扩展的状态。
