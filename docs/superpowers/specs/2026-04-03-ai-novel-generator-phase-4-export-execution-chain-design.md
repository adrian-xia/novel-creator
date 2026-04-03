# AI 小说生成器 Phase 4 导出执行链设计文档

## 1. 目标

本子项目是 `Phase 4` 在 `DecisionSession` 闭环之后的后续切片，目标是补齐“人工导出执行链”，但明确不做真实平台发布。

本切片完成后，内部控制台应支持：

- 只对 `approved` 章节发起导出
- 在控制台中手动多选具体章节进行批量导出
- 同步生成导出结果，不进入异步 worker 队列
- `plain_text` / `markdown` 导出单文件
- `bundle` 导出 zip 压缩包
- 在导出前提供可读预览
- 导出结果一次性返回，不保留历史记录

## 2. 范围

### 2.1 本子项目包含

- `approved` 章节的可导出列表查询
- 控制台中的多章勾选与格式选择
- 导出预览接口与页面
- 实际导出接口
- `plain_text`、`markdown`、`bundle` 三种格式的组装
- `bundle` 压缩包生成
- 导出输入校验、错误处理、测试与 smoke 覆盖

### 2.2 本子项目不包含

- 真实平台发布
- 平台连接器
- 导出历史记录
- 导出结果持久化保存
- 异步任务队列
- 对未 `approved` 章节的导出
- 章节区间输入式批量选择

## 3. 已确认范围

本设计基于以下确认结论：

- 只继续做 `Phase 4` 的导出执行链，不做真实平台发布
- 只允许对 `approved` 章节导出
- 导出只能从控制台手动触发
- 支持批量功能，但批量选择方式是“多选具体章节”
- 一次批量导出生成一个批次产物
- 导出同步执行，点击后直接返回结果
- `plain_text` / `markdown` 可直接预览
- `bundle` 只预览目录、`manifest`、章节摘要
- 导出结果一次性返回，不保留历史、不提供重复下载
- `plain_text` / `markdown` 导出为单文件
- `bundle` 导出为 zip 压缩包
- `bundle` 内包含：
  - 一个合并后的主文稿文件
  - `manifest/元数据`
  - 各章节摘要

## 4. 设计原则

1. 导出链与真实发布链解耦，不复用平台发布流程语义。
2. 导出结果是同步生成的一次性响应，不持久化为历史 artifact。
3. 导出预览与真正导出必须共享同一套组装逻辑，避免预览与下载不一致。
4. 批量导出应以“一个批次产物”为中心，而不是多次单章任务拼接。
5. 非法输入直接拒绝，不做隐式降级或部分成功。

## 5. 总体架构

本子项目拆成 4 个薄层：

### 5.1 Exportable Chapter Query

- 负责查询当前项目下可导出的 `approved` 章节
- 只返回控制台选择所需的最小字段：
  - `chapterNumber`
  - `title`（若存在）
  - `summary`
  - `updatedAt`

### 5.2 Export Preview Layer

- 负责根据用户选择的章节和格式生成预览对象
- 不生成最终下载响应
- 不写数据库
- 对 `bundle` 只返回结构化预览，不返回 zip 二进制

### 5.3 Export Assembler

- 负责把章节正文、摘要和元数据组装成最终导出内容
- 是本切片的核心纯逻辑层
- 输出：
  - `plain_text` 文件内容
  - `markdown` 文件内容
  - `bundle` zip 内容

### 5.4 Download Response Layer

- 负责把组装结果映射为 HTTP 响应
- 设置 `content-type` 与 `content-disposition`
- 对同步导出直接返回文件内容

## 6. 数据模型

本切片不新增持久化表，仅新增瞬时请求/响应模型。

### 6.1 ExportBatchRequest

字段：

- `projectId`
- `chapterNumbers: number[]`
- `format: 'plain_text' | 'markdown' | 'bundle'`

约束：

- `chapterNumbers` 不能为空
- 去重后按升序归一化
- 所有章节必须存在且状态为 `approved`

### 6.2 ExportPreview

公共字段：

- `projectId`
- `chapterNumbers`
- `format`
- `chapterCount`

`plain_text` / `markdown` 额外返回：

- `content`
- `chapterSummaries`

`bundle` 额外返回：

- `files`
- `manifest`
- `chapterSummaries`

### 6.3 GeneratedExport

字段：

- `fileName`
- `contentType`
- `content`
- `kind: 'text' | 'binary'`

说明：

- `plain_text` / `markdown` 属于 `text`
- `bundle` 属于 `binary`

## 7. 导出格式

### 7.1 plain_text

- 返回 `.txt`
- 内容为多章正文按章节顺序拼接
- 章节之间用稳定分隔符分开

### 7.2 markdown

- 返回 `.md`
- 内容为多章正文按章节顺序拼接
- 每章以 Markdown 标题起始

### 7.3 bundle

- 返回 `.zip`
- 内部固定结构：
  - `manuscript.md`
  - `manifest.json`
  - `chapter-summaries.json`

其中：

- `manuscript.md`
  - 合并后的主文稿文件
- `manifest.json`
  - 至少包含：
    - `projectId`
    - `exportedAt`
    - `format`
    - `chapterNumbers`
    - `chapterCount`
    - `totalWordCount`
- `chapter-summaries.json`
  - 每章至少包含：
    - `chapterNumber`
    - `title`
    - `summary`
    - `wordCount`

## 8. API 设计

本切片建议补 3 个导出接口：

### 8.1 `GET /projects/:projectId/exportable-chapters`

返回当前项目所有可导出的 `approved` 章节。

### 8.2 `POST /projects/:projectId/exports/preview`

输入 `ExportBatchRequest`，返回 `ExportPreview`。

用途：

- 控制台预览
- 导出前确认

### 8.3 `POST /projects/:projectId/exports`

输入 `ExportBatchRequest`，直接返回导出文件。

响应语义：

- `plain_text`：`text/plain`
- `markdown`：`text/markdown`
- `bundle`：`application/zip`

## 9. 页面设计

本切片不新开独立大页面，而是在现有 `Publish Center` 中增加 `Export Batch` 区。

### 9.1 章节选择区

- 展示当前项目所有 `approved` 章节
- 支持多选具体章节
- 明确展示是否已选中

### 9.2 格式与预览区

- 格式单选：
  - `plain_text`
  - `markdown`
  - `bundle`
- 点击预览后显示：
  - `plain_text`：正文预览
  - `markdown`：源码预览
  - `bundle`：文件清单、`manifest` 摘要、章节摘要

### 9.3 执行区

- 一个明确的“导出”按钮
- 触发同步请求
- 浏览器直接接收文件响应

## 10. 阅览策略

### 10.1 plain_text

- 在控制台直接展示合并后的文本内容

### 10.2 markdown

- 在控制台展示 Markdown 源内容

### 10.3 bundle

- 不解压展示全文
- 只展示：
  - 压缩包内文件列表
  - `manifest` 预览
  - `chapter-summaries` 预览

## 11. 错误处理

以下情况直接拒绝导出：

- 章节列表为空
- 章节号重复或非法
- 任意章节不存在
- 任意章节状态不是 `approved`
- 任意章节正文缺失
- 任意章节摘要缺失
- `bundle` 组装失败

错误响应必须尽量指出具体章节号或失败原因，不做“部分成功”。

## 12. 测试策略

### 12.1 单元测试

覆盖：

- 章节选择归一化
- 三种格式的导出组装
- `bundle` 目录结构和 `manifest` 内容
- 预览与导出内容一致性

### 12.2 集成测试

覆盖：

- 只返回 `approved` 章节
- 多选章节预览
- 多选章节导出
- 非 `approved` 章节被拒绝
- `bundle` 导出响应头和文件名

### 12.3 页面测试

覆盖：

- 批量勾选章节
- 格式切换
- `plain_text` / `markdown` 预览
- `bundle` 摘要预览

### 12.4 Smoke

至少验证：

1. 查询可导出章节
2. 生成一个批量导出预览
3. 成功下载一个导出结果

## 13. 验收标准

本子项目完成时必须满足：

1. 只能对 `approved` 章节发起导出。
2. 控制台支持多选具体章节批量导出。
3. `plain_text` / `markdown` 可预览并导出单文件。
4. `bundle` 可预览目录/摘要，并导出 zip。
5. 导出同步返回结果，不保留历史记录。
6. 不依赖真实平台发布链或平台连接器。

## 14. 与现有发布链的关系

本切片仍可复用现有领域名词与格式定义：

- `defaultExportFormat`
- `plain_text`
- `markdown`
- `bundle`

但不复用 `PublishTask` / `ExportArtifact` 的持久化链路。本切片是一个独立的“同步导出执行链”，只服务控制台内的一次性导出。
