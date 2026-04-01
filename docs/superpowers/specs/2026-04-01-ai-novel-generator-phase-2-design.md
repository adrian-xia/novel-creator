# AI 小说生成器 Phase 2 设计文档

## 1. 目标

Phase 2 的目标是把 Phase 1 的基础骨架扩展成一条真实可运行的小说生产主链，覆盖：

- 总纲生成
- 分部生成
- 单章计划生成
- 单章正文生成
- 审核与有限次自动改写
- 章节摘要回灌故事状态

本阶段的结果应该是：系统可以从一个已创建的小说项目出发，持续推进 `outline -> volume -> chapter -> review/rewrite`，并把已通过章节沉淀为下一章可消费的结构化状态。

## 2. 范围

### 2.1 本阶段包含

- `GenerateOutlineFlow`
- `GenerateVolumePlanFlow`
- `GenerateChapterFlow`
- `ReviewRewriteFlow`
- 故事状态和章节状态持久化增强
- agent 执行记录持久化
- 生产链相关 API 和最小控制台页面补强
- 集成测试和端到端 smoke

### 2.2 本阶段不包含

- `DecisionSession` 交互式确认页
- 平台上传与发布流程
- 多章预生成和复杂批量排程
- 复杂成本告警和 provider fallback drills
- 完整工作流观测大盘

这些内容继续留在后续 Phase。

## 3. 设计原则

1. 先打通一条窄而真的生产主链，再扩外围能力。
2. 状态必须先于提示词存在，agent 只消费结构化状态。
3. 同一本小说同一时刻只允许一个活跃章节流水线。
4. 每一步都必须可审计、可重试、可回放输入。
5. 审核与改写只做有限自动闭环，超过阈值直接阻塞等待后续人工决策能力。

## 4. 总体方案

Phase 2 采用垂直切片优先方案。先将项目详情页、API、workflow、agent runtime 和 storage 贯通，形成一个能真实推进章节的生产链，而不是先横向铺满所有 agent 再集成。

核心闭环如下：

1. 从项目输入生成结构化总纲。
2. 基于总纲生成分部计划。
3. 计算下一章位置并生成章节计划。
4. 根据章节计划生成正文草稿。
5. 对草稿进行结构化审核。
6. 对可自动修复的问题执行 1 到 2 次改写。
7. 审核通过后生成章节摘要并回灌故事状态。

## 5. 核心状态模型

Phase 2 新增或强化 4 类核心状态。

### 5.1 StoryState

`StoryState` 是故事真相源，至少包含：

- `storyBible`
- `outline`
- `volumePlans`
- `confirmedFacts`
- `openForeshadowing`
- `chapterSummaries`
- `currentPosition`

其中 `chapterSummaries` 只保存供后续章节消费的摘要层，不保存全书正文拼接结果。

### 5.2 ChapterState

每一章都应有显式状态机：

- `pending`
- `planned`
- `drafted`
- `in_review`
- `needs_rewrite`
- `approved`
- `blocked_for_manual_decision`
- `failed`

Phase 2 不引入“已发布”之类状态，避免与后续发布链路混淆。

### 5.3 AgentRun

每次 agent 执行都记录一条 `AgentRun`，至少包括：

- `projectId`
- `chapterId`
- `agentType`
- `promptConfigVersion`
- `provider`
- `model`
- `apiKeyId`
- `leaseId`
- `inputSnapshot`
- `rawOutput`
- `parsedOutput`
- `status`
- `tokenUsage`
- `errorMessage`

### 5.4 ReviewOutcome

审核输出必须结构化，至少包含：

- `decision`
- `issues`
- `severity`
- `rewriteInstructions`
- `canAutoRewrite`
- `triggeredManualDecision`

## 6. Agent 职责与上下文装配

Phase 2 固定使用以下 agent：

- `outline-agent`
- `volume-agent`
- `chapter-plan-agent`
- `chapter-draft-agent`
- `review-agent`
- `rewrite-agent`

### 6.1 上下文装配规则

不同 agent 的上下文必须故意不一致，由系统装配，agent 不得自行扩权读取更多内容。

#### outline-agent

只读取：

- 项目输入
- 小说类型
- 目标章节数
- 风格与禁忌
- 平台约束

#### volume-agent

只读取：

- 已确认总纲
- 目标章节数
- 节奏要求
- 结局方向

#### chapter-plan-agent

只读取：

- 当前卷计划
- 最近 3 到 5 章摘要
- 已确认事实
- 未回收伏笔
- 当前章节序号和位置

#### chapter-draft-agent

只读取：

- 当前章节计划
- 当前卷摘要
- 最近几章摘要
- 人物口吻和风格约束
- 必须遵守的硬性事实

不得默认读取整本小说正文。

#### review-agent

必须同时读取：

- 当前草稿
- 当前章节计划
- 故事约束
- 最近章节摘要
- 审核 rubric

#### rewrite-agent

只读取：

- 当前草稿
- 审核问题清单
- 修订目标
- 不可改动项

### 6.2 输出约束

- `outline-agent`、`volume-agent`、`chapter-plan-agent`、`review-agent` 必须输出 schema 化结构。
- `chapter-draft-agent` 可以输出自由正文，但必须带 metadata。
- `rewrite-agent` 输出新的 draft version 和修订说明。
- 结构解析失败时直接视为 step 失败，不做静默降级。

## 7. 工作流设计

Phase 2 拆成 4 条主 flow，而不是一个大流程。

### 7.1 GenerateOutlineFlow

步骤：

1. 读取项目输入和 prompt 配置
2. 获取 LLM 容量租约
3. 执行 `outline-agent`
4. 解析并校验输出
5. 写入 `OutlineRecord` 与 `StoryState`
6. 记录 `AgentRun`

### 7.2 GenerateVolumePlanFlow

步骤：

1. 读取已确认总纲
2. 获取 LLM 容量租约
3. 执行 `volume-agent`
4. 解析并校验输出
5. 写入 `VolumePlanRecord[]`
6. 更新 `StoryState.currentPosition`
7. 记录 `AgentRun`

### 7.3 GenerateChapterFlow

步骤：

1. 锁定项目级章节流水线
2. 计算下一章序号
3. 执行 `chapter-plan-agent`
4. 写入 `ChapterPlanRecord`
5. 执行 `chapter-draft-agent`
6. 写入 `ChapterDraftRecord`
7. 更新 `ChapterState` 为 `drafted`
8. 记录两次 `AgentRun`

### 7.4 ReviewRewriteFlow

步骤：

1. 执行 `review-agent`
2. 写入 `ReviewOutcome`
3. 若 `decision=approve`，生成章节摘要并回灌 `StoryState`
4. 若 `decision=rewrite` 且次数未超阈值，执行 `rewrite-agent`
5. 写入新 `ChapterDraftVersion`
6. 重新进入 review
7. 若超过阈值或触发关键节点，标记 `blocked_for_manual_decision`

### 7.5 重试边界

- `outline`、`volume`、`chapter-plan`、`chapter-draft`、`review`、`rewrite` 都以 step 为粒度重试。
- 已成功持久化的 step 不应在重试中重复写入相同版本。
- 章节 version 应使用显式递增版本号，避免重复落库。

## 8. API 与控制台范围

Phase 2 仅新增支撑生产链的最小接口和页面。

### 8.1 API

新增或补强：

- 触发总纲生成
- 触发分部生成
- 触发生成下一章
- 查询项目 story state
- 查询章节列表与章节状态
- 查询单章 plan、draft、review、rewrite 历史
- 查询最近 agent runs
- 重试失败 flow

### 8.2 控制台页面

补强现有项目详情页，增加：

- `Story Production` 面板
- 总纲查看区
- 分部查看区
- 章节状态列表
- 单章详情区
- 最近 agent runs 区块

对 `blocked_for_manual_decision` 仅展示只读提示，不在 Phase 2 内实现交互式决策。

## 9. 错误处理与状态迁移

Phase 2 明确以下错误语义：

- provider 容量不足：标记为 `waiting_for_capacity`
- agent 输出不符合 schema：标记为 `failed_invalid_output`
- repository 写入失败：step 失败，可直接重试
- review 多次不通过：标记为 `blocked_for_manual_decision`
- workflow 中断：依赖持久化状态恢复，不重复推进已完成 step

章节状态迁移遵循：

`pending -> planned -> drafted -> in_review -> approved`

或：

`in_review -> needs_rewrite -> in_review`

或：

`in_review -> blocked_for_manual_decision`

## 10. 测试策略

### 10.1 单元测试

覆盖：

- 上下文装配
- prompt 渲染
- 章节状态迁移
- review/rewrite policy
- chapter summary 回灌逻辑

### 10.2 集成测试

覆盖：

- 从 API 触发 outline 并持久化
- 从 volume 生成到 chapter plan/draft 持久化
- review/rewrite 循环的有限次数策略
- `AgentRun` 和 `ReviewOutcome` 的落库

### 10.3 端到端 smoke

至少验证：

1. 创建项目
2. 生成总纲
3. 生成分部
4. 生成第一章计划和草稿
5. 审核通过第一章
6. 第一章摘要进入第二章上下文装配

## 11. 验收标准

Phase 2 完成时必须满足：

1. 可以从项目输入稳定生成结构化总纲和分部计划。
2. 可以为项目生成至少第一章的计划、草稿和审核结果。
3. 审核通过后的章节摘要会回灌故事状态，并影响下一章上下文。
4. agent 执行记录、review 结果和章节版本可在 API 或控制台中查看。
5. 自动改写有明确上限，超限后不会无限循环。

## 12. 后续衔接

Phase 3 将在此基础上继续补：

- 决策会话页
- 关键节点人工决议写回
- 平台发布流程
- 工作流观察与失败重试增强

Phase 2 不预埋复杂 UI 和发布逻辑，但所有阻塞状态命名和记录方式都要兼容后续接入。
