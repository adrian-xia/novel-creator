# AI 小说生成器项目继续入口与有界自动续章设计

## 1. 目标

本设计用于补齐“项目现在停在哪、能不能继续、继续会发生什么”这一层产品和执行闭环。

完成后，系统应支持：

- 在项目详情页明确展示当前生产状态摘要，而不是只展示原始 JSON 数据
- 为单个项目提供统一的“继续项目”入口
- 由后端根据当前状态决定最合理的下一条 workflow，而不是让前端猜测
- 对章节链提供有界自动续章能力，使一次继续可以安全地多推进一步，但不会失控地无限连跑

## 2. 范围

### 2.1 本子项目包含

- `productionStatus` 项目生产状态摘要模型
- 项目详情 API 中的继续建议与阻塞原因
- `continue project` API
- 章节链的有界自动续章策略
- 项目详情页上的继续入口与状态展示
- 对继续策略、冲突保护、自动续章停止条件的测试补强

### 2.2 本子项目不包含

- 常驻后台调度器
- 无限自动续章或全书无人值守生成
- 新的人工 gate 类型
- 多项目批量调度
- 实时推送或 websocket 进度流

## 3. 问题定义

当前系统已经具备：

- outline / volume gate 确认后的自动排队
- blocked decision resolution 后的恢复排队
- `generate-chapter-flow` 内部的生成与 review/rewrite 闭环
- `chapter-replan-flow` 的恢复执行器

但项目级使用体验仍有两个明显缺口：

1. 项目页不知道“现在为什么停下”以及“下一步应该点什么”。
2. 项目继续动作仍然分散在多个入口，没有一个统一的后端判定层。

这会导致系统虽然具备很多基础能力，但仍然更像“可测试的内部模块集合”，而不是“用户可以顺畅继续工作的控制台”。

## 4. 设计原则

1. 继续策略必须由后端决定，前端只负责展示和触发。
2. 一次继续只做一个安全边界内的推进，不把项目推入不可预测的长链执行。
3. 已有 open gate、running workflow、pending recovery task 时，必须优先处理冲突，而不是盲目继续。
4. 继续动作必须返回清晰结果：是否已排队、排了哪条 flow、为什么不能继续。
5. 项目页应先从“原始 JSON 控制台”升级到“状态摘要 + 行动入口”，但仍保留调试信息可见性。

## 5. 方案比较

### 5.1 方案 A：只加一个继续按钮

前端调用一个轻量 API，后端做简单分支判断，直接排队下一条 flow。

优点：

- 实现最快
- 对现有结构侵入最小

缺点：

- 项目页仍然不清楚当前为什么能继续或不能继续
- 继续策略会散落在 route 里，不利于后续扩展

### 5.2 方案 B：增加状态摘要层 + 统一继续策略

在项目详情中返回结构化 `productionStatus`，并增加统一 `continue project` API。前端先展示状态，再触发后端推荐继续动作。

优点：

- 产品语义清晰
- 后端策略集中
- 后续可平滑扩展到更强的自动推进

缺点：

- 比单一按钮多一层模型设计

### 5.3 方案 C：直接做全自动持续续章

点击后持续运行，直到遇到 gate 或失败。

优点：

- 使用体验最自动化

缺点：

- 容易与后台调度器耦合
- 一次性引入过多状态机复杂度
- 当前阶段过度设计

## 6. 选型

采用方案 B，并在章节继续上引入“有界自动续章”：

- `continue project` 由后端统一决定下一条 workflow
- 如果下一步进入 `generate-chapter-flow`，允许在本次继续内最多额外再续 1 章
- 一旦遇到新的 human gate、blocked decision、pending recovery、running workflow，就停止自动推进

这是一个刻意保守的设计。它可以明显提升可用性，但不会把当前项目过早推向复杂的后台编排系统。

## 7. 核心对象设计

### 7.1 `ProductionStatus`

新增项目级状态摘要，至少包含：

- `phase`
  - `needs_outline`
  - `waiting_outline_confirmation`
  - `needs_volume`
  - `waiting_volume_confirmation`
  - `needs_chapter_generation`
  - `chapter_in_progress`
  - `blocked_for_decision`
  - `needs_replan_recovery`
  - `running_workflow`
  - `paused`
- `canContinue: boolean`
- `recommendedAction`
  - `generate_outline`
  - `generate_volume`
  - `generate_next_chapter`
  - `resume_review_rewrite`
  - `run_replan_recovery`
  - `open_human_gate`
  - `wait_for_running_workflow`
  - `none`
- `reason`
- `activeWorkflowRunId: string | null`
- `openSessionId: string | null`
- `pendingRecoveryTaskId: string | null`
- `nextChapterNumber: number | null`
- `autoContinueBudget`
  - 当前设计固定为 `1`

### 7.2 `ContinueProjectResult`

继续接口返回统一结果：

- `projectId`
- `continued: boolean`
- `action`
- `reason`
- `workflowRunId: string | null`
- `flowName: string | null`
- `autoContinuedChapters: number`

## 8. 后端继续策略

`continue project` 的推荐顺序如下：

1. 若存在 `running` 或 `queued` workflow run：
   - 不再排新任务
   - 返回 `continued = false`
   - `recommendedAction = wait_for_running_workflow`
2. 若存在 open human gate：
   - 不再排新任务
   - 引导打开对应 gate
3. 若存在 pending recovery task：
   - 优先排 `chapter-replan-flow`
4. 若项目尚无 outline：
   - 排 `generate-outline-flow`
5. 若 outline 已确认但 volume plans 不存在：
   - 排 `generate-volume-flow`
6. 若 volume plans 已确认且当前没有章节进行中：
   - 排 `generate-chapter-flow`
7. 若最近章节卡在 `blocked_for_manual_decision` 且已有 resolved resolution 指向 `resume_current_chapter`：
   - 排 `review-rewrite-flow`
8. 其他情况：
   - 返回不能继续的明确原因

## 9. 有界自动续章策略

### 9.1 触发点

当 `continue project` 选择了 `generate-chapter-flow` 时，允许该继续动作附带一个小预算：

- `maxAutoContinuationChapters = 1`

### 9.2 继续条件

仅当以下条件同时满足时，才会自动追加下一章：

- 本次 `generate-chapter-flow` 成功结束
- 最终章节状态为 `approved`
- 当前没有新的人工 gate
- 当前没有新的 pending recovery task
- 当前没有并发中的 workflow run

### 9.3 停止条件

出现以下任一情况即停止：

- 章节进入 `blocked_for_manual_decision`
- 新的 human gate 被创建
- 新的 recovery task 被创建
- 章节未 `approved`
- 已达到本次自动续章预算

### 9.4 设计边界

本设计不把自动续章做成常驻循环器，而是做成一次继续动作内的有限追加。这样可避免 worker 递归失控，也能保留用户对系统推进节奏的掌控。

## 10. API 与页面改造

### 10.1 项目详情 API

在现有 `/projects/:projectId` 响应中增加：

- `productionStatus`
- `continueRecommendation`

### 10.2 继续项目 API

新增：

- `POST /projects/:projectId/continue`

由 route 调用统一的继续策略服务，服务负责：

- 读取项目详情、decision sessions、workflow runs、recovery tasks
- 生成 `ProductionStatus`
- 必要时创建新的 `WorkflowRun`

### 10.3 项目详情页

项目页新增：

- 当前阶段摘要
- 当前阻塞原因
- 推荐下一步
- 继续按钮
- 若不能继续，则展示明确原因和对应入口链接

原始 outline / volume / chapter / agent runs 数据仍可保留，但退居为调试信息区域。

## 11. 模块拆分

推荐增加一个小而清晰的策略层：

- `packages/workflows/src/project-continue.ts`
  - 统一计算 `ProductionStatus`
  - 统一执行 continue 逻辑
- `packages/storage/src/repositories/project-repository.ts`
  - 读取项目详情时补充 workflow run 与 recovery task 所需信息
- `apps/api/src/routes/story-production.ts`
  - 增加 continue route
- `apps/web/src/lib/api.ts`
  - 增加 continue 请求与新的 detail 类型
- `apps/web/src/app/projects/[projectId]/page.tsx`
  - 渲染状态摘要和继续入口

不把 continue 策略直接塞进 route handler，避免后续维护困难。

## 12. 错误处理

继续接口必须区分：

- `409` 风格的业务冲突
  - 已有运行中的 workflow
  - open gate 未处理
- `400` 风格的非法状态
  - 项目缺失必要基线但状态不一致
- `404`
  - 项目不存在

同时，返回体必须带人类可读的 `reason`，让前端直接展示，不需要自行拼接诊断信息。

## 13. 测试策略

### 13.1 策略层测试

覆盖：

- 无 outline 时推荐生成总纲
- outline gate 未确认时不可继续
- 有 pending recovery task 时优先恢复
- volume 已确认时推荐下一章
- 有 running workflow 时禁止继续

### 13.2 API 测试

覆盖：

- `/projects/:projectId` 返回新的 `productionStatus`
- `/projects/:projectId/continue` 在不同状态下的返回体
- continue 触发真实 `WorkflowRun` 创建

### 13.3 Web 测试

覆盖：

- 项目页显示推荐动作与阻塞原因
- 项目页在可继续时展示继续按钮
- 项目页在不可继续时展示跳转到 gate 或 runs 的指引

### 13.4 Smoke

覆盖一条最小继续链：

- 项目具备已确认 volume plans
- 点击 continue
- 后端返回新建的 `generate-chapter-flow`
- 项目页展示更新后的继续信息

## 14. 完成标准

满足以下条件即可视为本子项目完成：

- 项目页不再只是原始 JSON 输出，而能说明当前阶段和下一步
- 用户可以通过统一入口继续项目
- continue 逻辑由后端集中决策
- 章节继续具备有界自动续章能力
- 全量回归保持通过

## 15. 关键假设

本设计作出以下明确假设：

- open human gate 的优先级高于任何继续动作
- pending recovery task 的优先级高于新章节生成
- bounded auto-continue 的预算固定为 `1`，不在本阶段做可配置化
- “继续项目”优先解决当前停点，不尝试跨越多个未处理阻塞
