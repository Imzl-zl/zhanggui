# Recovery - Task Root Ownership 与冷启动恢复细则

这是 `/zhanggui` 编排器的内部支持文档，不是独立 skill。只在两种情况下读取：第一次写盘前建立 task-root ownership，或冷启动扫描发现恢复候选信号。真值优先序的一句话版本保留在 SKILL.md；本文件是完整流程。

## Task root ownership

第一次写磁盘前建立 task-root ownership：不存在或为空的根可采用，并在写任务工件前创建 `<task_root>/.zhanggui-root`，内容至少为 `version: zhanggui/v0.4`；非空根只有该 marker 存在且版本匹配时才自动视为本工作流所有。无 marker 或版本不匹配的非空 `.tasks/` / `.zhanggui/tasks/` / `.codex-tasks/` 一律视为 foreign/legacy，不静默复用、迁移或双写。

默认 `.tasks/` 不可采用时，先读项目根 `.zhanggui/config.yaml`；其 schema 是 `version: zhanggui/v0.4` + 项目内规范化相对路径 `task_root`（禁止绝对路径和 `..`）。没有配置时采用确定性后备 `.zhanggui/tasks/` 并写 marker；后备也不可采用时只问一次。非默认自定义根必须写入该 config，不能只保存在 checkpoint。config 和 root marker 只证明 ownership/discovery，不是设计或任务状态真值。

## 冷启动恢复流程

1. 先从用户给出的 checkpoint、项目根 `.zhanggui/config.yaml`、带 `.zhanggui-root` marker 的默认 `.tasks/` 和确定性后备 `.zhanggui/tasks/` 得到候选根；无 marker 的非空根只作为 foreign/legacy 导入候选，未经明确采用/迁移不得读取为活动真值。
2. 同一 task 按真值优先序恢复：存在 `DESIGN.md` 时无论候选 SPEC/EPIC 是否也存在，都 hydrate DESIGN 并重建候选；没有 DESIGN 但 PROGRESS 有 active `Design Drift` 时读取 SPEC/EPIC + drift state；两者都没有但 TODO/SUBTASKS 含 `IN_PROGRESS`、`FAILED`、未完成项，或 `FinalizationStatus` 为 `active` / `pending-validation` / `pending-cleanup` 时，读取 SPEC/EPIC + CSV + PROGRESS 并恢复 execution。`complete` 且已归档/删除的 tracker 不属于候选。`PROGRESS.md` 含 `Parent:` 字段的目录不是独立候选，一律经其父 epic 的 `SUBTASKS.csv` 恢复，child 位置由 `task_dir` 决定。
3. 按目标和更新时间能得到唯一明确 task 时直接恢复；多个 task 都合理时列出简短候选并只问一次，不得猜。用户请求已含明确新目标且不匹配任何候选时，不提问也不恢复：返回普通意图分类，只在首轮回复附一句可恢复任务提示。优先序只解决同一 task 的真值，不能替用户在多个 task 间选择。
4. 校验 version、task_root 和必要字段；Design/Drift 根据 decisions、depends_on、fog、prototype、consensus、current/awaiting/return point 重算 frontier，Execution 根据 CSV 真值重算 dependency-ready task 和父子状态。
5. 从 pending prototype、待回答 node、待确认 consensus、design drift 或未完成 execution task 继续；不得重新建图、重问已定决定或为恢复另建 tracker。
