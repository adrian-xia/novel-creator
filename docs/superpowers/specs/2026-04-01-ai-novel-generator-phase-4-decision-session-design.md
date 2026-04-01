# AI 小说生成器 Phase 4 决策会话设计文档

## 1. 目标

Phase 4 的目标是把 Phase 3 里的 `DecisionSession` 从页面骨架升级成真实可执行的闭环系统，使其能够：

- 对关键剧情节点开启真实多轮连续对话
- 保留完整会话历史和上下文
- 生成并保存结构化 `DecisionResolution`
- 根据决议恢复生产链，并重规划“当前章 + 动态指定范围”的后续章节

本阶段完成后，`blocked_for_manual_decision` 不再只是一个静态停机状态，而会变成一个真实的“人机对话决策 -> 结构化决议 -> 工作流恢复”链路。

## 2. 范围

### 2.1 本阶段包含

- 真实 `DecisionSession` 多轮对话读写闭环
- `DecisionSession` 上下文快照与消息历史
- 决策助手真实回复
- 结构化决议草稿生成与最终确认
- 决议后的 `replan window` 恢复机制
- 当前章与指定后续章节的计划失效与重规划任务生成
- `DecisionSession` 相关 API、worker 流程和页面升级

### 2.2 本阶段不包含

- 已发布章节回滚
- 决议分叉、版本树、会话回放 diff
- 真实发布链和真实平台连接器
- 高级 observability 大盘
- 多用户与权限

## 3. 设计原则

1. 对话历史和最终决议必须分离保存。
2. 后续工作流恢复只能消费结构化决议，不能解析聊天记录。
3. 决议影响范围必须显式声明，支持动态指定章节区间。
4. 恢复逻辑由 worker 驱动，UI 只提交消息和决议。
5. 已发布章节不自动回滚，决议只影响未发布范围。

## 4. 总体架构

Phase 4 的 `DecisionSession` 拆成 4 个部分：

1. `DecisionSession Aggregate`
   - 负责保存一次决策会话的主状态、来源、触发原因和生命周期。

2. `Conversation Runtime`
   - 负责多轮会话本身，包括消息历史、上下文装配、助手回复和候选方向整理。

3. `Resolution Engine`
   - 负责把对话结果收敛成结构化 `DecisionResolution`，并验证决议字段是否合法。

4. `Recovery Flow`
   - 负责在决议落库后更新故事状态、标记章节计划失效、生成重规划窗口并恢复工作流。

## 5. 决策会话模型

### 5.1 触发

当 `ReviewOutcome` 命中关键剧情节点并给出 `blocked_for_manual_decision` 时：

- 当前章节状态被冻结为 `blocked_for_manual_decision`
- 创建 `DecisionSession`
- 记录来源 `ReviewOutcome`
- 保存一份 `DecisionContextSnapshot`
- 进入可多轮对话状态

### 5.2 多轮会话

每次助手回复都基于以下上下文装配：

- 当前章节与当前卷目标
- 最近章节摘要
- 审核问题
- 已确认故事事实
- 当前会话的全部历史消息
- 当前已生成的候选决策或决议草稿

会话必须支持：

- 多轮连续对话
- 消息按顺序持久化
- 会话状态变化可追踪
- 多次生成新的候选决议草稿

### 5.3 会话状态

`DecisionSession.status` 建议收敛为：

- `open`
- `awaiting_assistant_reply`
- `awaiting_human_input`
- `awaiting_resolution_confirmation`
- `resolved`
- `cancelled`

## 6. 结构化决议

### 6.1 决议字段

`DecisionResolution` 至少包含：

- `resolutionType`
  - `accept_current`
  - `accept_alternative`
  - `replan_required`
  - `pause_project`
- `decisionSummary`
- `storyFactsToApply`
- `chapterPlanAdjustments`
- `volumeImpact`
- `nextAction`
  - `resume_current_chapter`
  - `replan_window`
  - `pause_project`
- `replanRange`
  - `startChapter`
  - `endChapter`
- `resumeFromChapter`
- `invalidateExistingPlans`

### 6.2 决议语义

- `accept_current`
  表示保留当前方向，但仍允许声明一个小范围后续重规划窗口。
- `accept_alternative`
  表示接受会话中讨论出的替代方向，并进入局部重规划。
- `replan_required`
  表示当前方向不可继续，需要对指定范围内章节进行重新规划。
- `pause_project`
  表示暂停该项目，不恢复自动生产。

### 6.3 决议约束

- `replanRange.startChapter` 必须小于等于 `replanRange.endChapter`
- `resumeFromChapter` 必须落在 `replanRange` 内或等于当前章节
- 已发布章节不得被包含进自动重规划范围
- 当 `resolutionType = pause_project` 时，不应生成重规划任务

## 7. 恢复机制

### 7.1 恢复链

当决议确认后，worker 触发恢复链：

1. 保存最终 `DecisionResolution`
2. 将当前会话标记为 `resolved`
3. 更新 `StoryState` 中的已确认事实
4. 更新当前章节状态
5. 标记 `replanRange` 内已有章节计划失效
6. 为 `resumeFromChapter` 之后的章节生成 `ChapterRecoveryTask`
7. 触发 `chapter-replan-flow`

### 7.2 章节状态变化

`ChapterStateRecord` 增加并使用：

- `needs_replan`
- `paused_by_decision`

恢复时：

- 当前章可进入 `needs_replan`
- 决议范围内未发布章节可进入 `needs_replan`
- `pause_project` 时项目进入暂停状态，章节不自动恢复

### 7.3 计划失效策略

当 `invalidateExistingPlans = true` 时：

- `replanRange` 内已有 `ChapterPlanRecord` 标记为失效
- 对应的未发布草稿标记为废弃或待人工复核
- 后续章节重新进入 plan 生成流程

## 8. 页面设计

`DecisionSession` 页面升级为真实决策台，分成 4 个区：

1. `会话背景区`
   - 展示触发原因、审核问题、当前卷目标、最近剧情摘要。

2. `多轮对话区`
   - 展示完整消息历史并支持连续输入。

3. `候选决议区`
   - 展示助手当前整理出的候选方向和草稿总结。

4. `结构化决议区`
   - 允许你最终确认：
     - 决议类型
     - 事实修改
     - 影响章节范围
     - 恢复起点

页面不直接执行恢复逻辑，只负责提交消息、生成草稿、确认决议。

## 9. API 设计

Phase 4 至少补这些真实接口：

- `GET /decision-sessions`
  - 列出待处理会话
- `GET /decision-sessions/:sessionId`
  - 返回会话详情、上下文快照、消息历史、当前草稿
- `POST /decision-sessions/:sessionId/messages`
  - 追加一条用户消息并触发助手回复任务
- `POST /decision-sessions/:sessionId/generate-resolution`
  - 基于当前对话生成结构化决议草稿
- `POST /decision-sessions/:sessionId/resolve`
  - 提交最终结构化决议并触发恢复
- `POST /decision-sessions/:sessionId/cancel`
  - 取消当前会话

## 10. Worker 流程

需要新增或补强这些 worker 步骤：

- `append-human-message`
- `load-decision-context`
- `assemble-decision-conversation-context`
- `run-decision-assistant`
- `persist-assistant-message`
- `generate-resolution-draft`
- `persist-resolution`
- `apply-resolution`
- `invalidate-plans-in-window`
- `enqueue-replan-window`

这条链需要被 `WorkflowRun` / `StepRun` 记录，以便后续 observability 页面展示。

## 11. 数据模型变更

建议补强如下对象：

- `DecisionSession`
  - `triggerReason`
  - `sourceReviewOutcomeId`
  - `contextSnapshot`
  - `currentDraftResolution`
  - `resolvedAt`
- `DecisionMessage`
  - `sequence`
  - `messageType`
- `DecisionResolution`
  - `replanRangeStartChapter`
  - `replanRangeEndChapter`
  - `resumeFromChapter`
  - `invalidateExistingPlans`
- `ChapterPlanRecord`
  - 增加计划失效标记
- `ChapterStateRecord`
  - 支持 `needs_replan`
  - 支持 `paused_by_decision`
- `ChapterRecoveryTask`
  - 记录恢复窗口和重规划任务

## 12. 测试策略

### 12.1 单元测试

覆盖：

- 决策上下文装配
- 多轮消息历史拼装
- 决议草稿生成
- `replanRange` 校验
- 恢复策略选择

### 12.2 集成测试

覆盖：

- `POST /messages` 后产生 assistant reply
- 多轮消息保留历史上下文
- `generate-resolution` 生成结构化草稿
- `resolve` 后当前章进入 `needs_replan`
- 指定范围内计划被标记失效

### 12.3 端到端 smoke

至少验证：

1. 章节进入 `blocked_for_manual_decision`
2. 创建 `DecisionSession`
3. 多轮对话并生成决议草稿
4. 提交最终决议
5. 生成 `replan window`
6. 从 `resumeFromChapter` 恢复

## 13. 验收标准

Phase 4 的 `DecisionSession` 子项目完成时必须满足：

1. 关键剧情节点能够进入真实多轮对话会话。
2. 会话历史可以持久化并参与后续助手回复。
3. 会话能够生成并确认结构化 `DecisionResolution`。
4. 决议可以动态指定后续章节影响范围。
5. 决议后可以自动对当前章和指定后续章节生成恢复任务。
6. 已发布章节不会被自动回滚或自动重规划。

## 14. 后续衔接

DecisionSession 闭环完成后，Phase 4 的下一个子项目应继续做：

- 真实发布执行链
- 真实平台连接器
- 单机 `docker compose` 部署与运维骨架
