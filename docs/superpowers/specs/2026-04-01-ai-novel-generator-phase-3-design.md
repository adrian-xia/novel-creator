# AI 小说生成器 Phase 3 设计文档

## 1. 目标

Phase 3 的目标是在 Phase 2 已经打通的自动生产主链之上，补齐三个关键缺口：

- 关键剧情节点的 `DecisionSession`
- 项目级配置化的发布与导出骨架
- 最小可用的 workflow observability

本阶段的结果应该是：当章节因关键剧情节点被阻塞时，系统可以进入人机决策会话并输出结构化决议；当章节通过审核后，系统可以按照项目级发布配置自动生成多条发布或导出任务；控制台中可以看到 workflow、决策、发布、导出的运行状态。

## 2. 部署约束

Phase 3 明确采用单机 `docker compose` 部署，不引入额外独立服务。

固定部署拓扑为 4 个容器：

- `app`
  - 承载 `Next.js` 页面和 API
- `worker`
  - 承载 workflow、队列消费、导出任务、发布任务、决策会话相关异步任务
- `postgres`
  - 业务数据持久化
- `redis`
  - 队列、锁、短期运行态

代码结构继续保持 monorepo 模块化，但部署单元不增加。Phase 1、Phase 2、Phase 3 都在同一套部署模型上演进，通过代码升级和数据库迁移推进，不切换部署形态。

## 3. 范围

### 3.1 本阶段包含

- `DecisionSession` 数据模型与 UI
- `DecisionSessionFlow`
- 项目级发布配置
- `PublishTask` 与 `ExportArtifact`
- 平台适配器接口和 fake adapter
- 人工导出链路
- workflow observability 页面和最小查询接口

### 3.2 本阶段不包含

- 真实平台连接器
- 多平台复杂差异逻辑
- 外部告警系统
- 成本/预算大盘
- 多用户/权限系统

## 4. 设计原则

1. Phase 3 继续沿用单机、少容器、强状态化的架构约束。
2. `DecisionSession` 只做剧情决策，不直接写正文。
3. 发布链路必须支持“自动上传”和“人工导出”并存。
4. 发布策略按项目配置，不做全局一刀切。
5. observability 只读业务状态，不承载核心业务逻辑。

## 5. 总体方案

Phase 3 拆成 3 条共享状态中心的业务链：

1. `DecisionSession Chain`
   - 负责从 `blocked_for_manual_decision` 进入剧情决策会话，再输出结构化决议并恢复流程。
2. `Publish/Export Chain`
   - 负责从“章节审核通过”出发，按项目配置生成自动发布任务和人工导出任务。
3. `Observability Chain`
   - 负责展示 workflow、决策会话、发布任务、导出任务的运行状态。

这三条链共享 Phase 2 已有的 `StoryState`、`ChapterState`、`ReviewOutcome`、`AgentRun`，但新增独立对象用于决策与发布。

## 6. DecisionSession 设计

### 6.1 触发条件

当 `ReviewOutcome` 满足任一条件时，创建 `DecisionSession`：

- `decision = blocked_for_manual_decision`
- `triggeredManualDecision = true`
- 审核标签命中关键剧情节点

关键剧情节点至少包括：

- 角色生死
- 关系确立或断裂
- 世界观重大揭示
- 卷终反转
- 结局收束前关键节点

### 6.2 决策包

每次 `DecisionSession` 开始前，系统自动生成 `DecisionPacket`，至少包含：

- 项目和章节信息
- 当前卷目标
- 最近章节摘要
- 当前章节审核问题
- 当前提案
- 风险分析
- 候选替代方向

### 6.3 对话模型

`DecisionSession` 页面承载你和“剧情确认助手”的对话。助手只围绕当前关键节点提供分析和替代方向，不生成正文。

对话内容需要结构化保存为 `DecisionMessage[]`，区分：

- `human`
- `assistant`
- `system`

### 6.4 结构化决议

最终决议必须从对话中收敛为结构化对象，不允许只留聊天记录。

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

### 6.5 状态机

`DecisionSession.status` 建议为：

- `open`
- `awaiting_model_reply`
- `awaiting_human_resolution`
- `resolved`
- `cancelled`

`ChapterState` 根据决议更新为：

- `approved`
- `blocked_for_manual_decision`
- `failed`

项目或后续章节推进状态可以根据 `DecisionResolution.nextAction` 转入“继续”“重规划”“暂停”。

## 7. 项目级发布配置

Phase 3 的发布配置必须按项目保存，而不是只靠全局平台配置。

### 7.1 PublishProfile

每个项目新增 `PublishProfile`，至少包含：

- `projectId`
- `publishEnabled`
- `autoPublishTargets`
- `manualExportTargets`
- `defaultExportFormat`
- `effectiveFromChapter`

### 7.2 多选规则

每个项目可以同时配置：

- 多个自动上传渠道
- 多个人工导出渠道

同一平台在同一项目里不能同时既自动上传又人工导出。

### 7.3 平台能力声明

平台自身需要声明能力边界：

- `supportsAdapterPublish`
- `supportsManualExport`
- `supportedExportFormats`

项目配置只能选择平台支持的模式。

## 8. 发布与导出链路

### 8.1 PublishTask

当章节审核通过后，系统按项目配置展开 `PublishTask`。

一个章节可能生成多条任务：

- 对每个 `autoPublishTarget` 生成一条 `adapter_publish`
- 对每个 `manualExportTarget` 生成一条 `manual_export`

`PublishTask` 至少包含：

- `projectId`
- `chapterNumber`
- `targetPlatform`
- `mode`
  - `adapter_publish`
  - `manual_export`
- `status`
- `payloadSnapshot`
- `artifactId`
- `attemptCount`
- `lastError`

### 8.2 PlatformAdapter

平台适配器接口 Phase 3 先做 fake adapter，但接口必须真实：

- `validateConfig()`
- `publishChapter()`
- `getPublishStatus()`

### 8.3 ExportArtifact

人工导出链路生成 `ExportArtifact`，支持的最小格式：

- `plain_text`
- `markdown`
- `bundle`

`bundle` 至少包含：

- 项目标题
- 平台名
- 章节序号
- 章节标题
- 正文
- 导出时间

### 8.4 发布状态机

`PublishTask.status` 建议为：

- `pending`
- `publishing`
- `published`
- `exporting`
- `exported`
- `manual_upload_pending`
- `manual_upload_confirmed`
- `failed`

流转规则：

- `adapter_publish`
  - `pending -> publishing -> published | failed`
- `manual_export`
  - `pending -> exporting -> exported -> manual_upload_pending -> manual_upload_confirmed`

## 9. Workflow Observability

Phase 3 不做独立监控系统，而是在内部控制台中加入可用的运行观察能力。

### 9.1 最小观察对象

- `WorkflowRun`
- `StepRun`
- `DecisionSession`
- `PublishTask`
- `ExportArtifact`

### 9.2 页面

最小页面集合：

- `Workflow Runs`
  - 最近 flow 运行列表
- `Run Detail`
  - 某次 run 的 step 列表和错误
- `Decision Queue`
  - 待决策章节列表
- `Publish Center`
  - 自动发布任务和人工导出任务列表

### 9.3 目标问题

observability 页面必须能帮助回答：

- 项目现在卡在哪一步
- 哪个 agent 最近失败了
- 哪个章节等待人工决策
- 哪个发布/导出任务还没完成

## 10. 数据模型

Phase 3 新增或扩展这些对象：

- `DecisionSession`
- `DecisionMessage`
- `DecisionResolution`
- `PublishProfile`
- `PublishTask`
- `ExportArtifact`
- `WorkflowRunView`
- `StepRun`

建议保持：

- 故事状态
- 决策状态
- 发布状态
- workflow 运行状态

四套数据边界相互独立，避免把业务状态混写到单一大表中。

## 11. API 与 UI 范围

### 11.1 API

Phase 3 API 至少包含：

- 查询待决策会话
- 获取决策包与对话历史
- 发送决策会话消息
- 提交结构化决议
- 查询项目发布配置
- 更新项目发布配置
- 查询发布任务列表
- 触发导出
- 标记人工上传完成
- 查询 workflow runs
- 查询 run detail

### 11.2 UI

Phase 3 页面至少包含：

- `DecisionSession` 对话页
- 项目详情中的发布配置区
- `Publish Center`
- `Workflow Runs`
- `Run Detail`

## 12. 测试策略

### 12.1 单元测试

覆盖：

- 决策决议结构化转换
- 发布策略展开
- export artifact 生成
- fake adapter 行为
- workflow observability view model

### 12.2 集成测试

覆盖：

- `blocked_for_manual_decision -> DecisionSession -> resolved`
- 审核通过 -> 按项目配置生成多条 `PublishTask`
- `manual_export` 任务生成 `ExportArtifact`
- workflow runs 和 step runs 可查询

### 12.3 端到端 smoke

至少验证：

1. 创建一个待决策章节
2. 打开决策会话并提交结构化决议
3. 章节恢复推进或进入新状态
4. 审核通过章节生成自动发布和人工导出任务
5. 导出任务生成可见产物
6. observability 页面可看到对应 workflow 和任务

## 13. 验收标准

Phase 3 完成时必须满足：

1. 关键剧情节点可以进入 `DecisionSession` 并输出结构化决议。
2. 每个项目可以独立配置自动上传渠道和人工导出渠道，可多选。
3. 章节通过后可按项目配置展开多条发布或导出任务。
4. 导出任务可生成可人工上传的产物，并支持手动确认上传完成。
5. 控制台可以查看 workflow、决策、发布、导出的运行状态。

## 14. 后续衔接

Phase 4 将在此基础上继续补：

- 真实平台连接器
- 成本与预算控制
- 更完整的回归套件
- provider fallback drills
- 更细粒度的观测与告警
