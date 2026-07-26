
# Executing Plans — 单一真值执行阶段

这是 `/zhanggui` 的 supporting stage，不是独立 skill。它接收已准备好的 Transient、Durable 或 Epic 工作，执行后返回 task delta；不创建第二套 tracker，也不通过宿主发起 nested skill invocation。需要工程子流程时，停止当前步骤并返回 `StageStatus: skill-required` 与完整 `SkillRequest`，由根激活 leaf、校验 SkillResult 后恢复同一编号步骤；本 stage 从不加载 sibling `SKILL.md`、不代 Embedded leaf 提问、不自行 merge leaf delta。

所有 `.tasks/...` 路径按 `WorkflowState.task_root` 解析；恢复和 shape 升级必须沿用同一个根。

磁盘 shape 还必须验证 `<task_root>/.zhanggui-root`；marker 缺失或版本不匹配时返回 blocked，不猜目录归属。

## 加载形态

### Transient

- 读取会话 plan、设计 handoff 和验收标准。
- 不创建 CSV、SPEC、PROGRESS 或项目根 TODO。
- 如果任务增长到需要恢复或风险显著上升，原地升级为 Durable。

### Durable

按顺序读取：

1. `.tasks/<task>/SPEC.md`
2. `.tasks/<task>/TODO.csv`
3. `.tasks/<task>/PROGRESS.md` 的恢复区

`TODO.csv` 是状态真值；会话 plan 是镜像。

### Epic

读取 `EPIC.md`、`SUBTASKS.csv`、父 `PROGRESS.md`，再按其 `task_dir` 读取当前 dependency-ready 子任务目录；child 不一定在父目录下（升级自 Durable 的 child 留在原位）。父 CSV 是子任务状态真值，子目录 CSV 是子任务内部状态真值。
父子状态重算规则：子任务只由子目录的 TODO.csv 决定；父项为 `FAILED` 当任一 child 为 `FAILED`，为 `IN_PROGRESS` 当没有失败但仍有未完成 child，为 `DONE` 仅当所有 child 都 DONE 且父级 final validation 通过。恢复时若父 CSV 与 child CSV 不一致，按 child 真值重算父项，不反向覆盖 child。

## Embedded Skill Dispatch

When a task step needs a leaf, stop the stage at that step and return:

```yaml
StageStatus: skill-required
SkillRequest:
  request_id: SR-<task-id>-<purpose>
  name: <exact leaf name>
  mode: zhanggui-embedded
  input: <fields required by that leaf>
  return_to: { phase: execute, node: <task-id> }
```

The root activates the leaf, validates SkillResult, then resumes this same numbered step. This stage never loads a sibling SKILL.md, never asks on behalf of an Embedded leaf, and never merges the leaf delta itself.

## 开工前检查

1. 目标、boundary、依赖和 validation 是否足以开始。
2. 文件、符号和接口是否仍与仓库一致。
3. `sync_targets` 是否覆盖公开接口、调用方、类型、schema、迁移、配置、测试和文档。
4. WorkflowState 的 `open_nodes` 与 `fog` 是否为空；若有 user-owned decisions，`consensus` 是否已 confirmed。
5. 高风险改动、并行子任务或用户要求隔离时，返回 `StageStatus: skill-required` 与 `SkillRequest`：`name: zhanggui-using-git-worktrees`，`mode: zhanggui-embedded`，`return_to: { phase: execute, node: <task-id> }`，由根建立隔离工作区并验证基线后恢复本步骤。

事实过时但不改变设计时，就地更新 tracker 并记录原因。发现设计缺口时返回 `StageStatus: design-drift` 和原 task return point，由当前编排 frame 恢复 design；不让用户手动重新路由。

## 状态机

```text
TODO → IN_PROGRESS → DONE
                  ↘ FAILED → IN_PROGRESS
```

- 任务开始时同步磁盘 CSV 与会话 plan。
- `DONE` 必须有当前 `validation` 的新鲜证据。
- 失败时保留 `IN_PROGRESS` 或标记 `FAILED`，在 notes 记录错误、已验证假设和下一策略。
- 串行 Durable 同一时刻最多一个 `IN_PROGRESS`；使用并行派发时允许多个写范围不冲突的行同时 `IN_PROGRESS`，但每行仍需独立 diff 与 validation 核实。
- Epic 只有在写范围互不冲突、依赖已完成时才能并行多个子任务；并行派发时返回 `StageStatus: skill-required` 与 `SkillRequest`：`name: zhanggui-dispatching-parallel-agents`，`mode: zhanggui-embedded`，`return_to: { phase: execute, node: <task-id> }`；根合并 leaf delta 后，子代理结果必须经 diff 与 validation 核实，不信任报告。

## 每个任务的执行循环

1. 重读磁盘真值（Durable 读 `TODO.csv`；Epic 读父 `SUBTASKS.csv` 与当前 child `TODO.csv`），再选择第一个依赖已满足的 `TODO` 或可重试 `FAILED`；不凭记忆中的行状态开工。
2. 标记 `IN_PROGRESS`，同步磁盘真值和会话 plan。
3. 永久生产功能、bugfix、refactor 或行为变化在写实现代码前返回 `StageStatus: skill-required` 与 `SkillRequest`：`name: zhanggui-test-driven-development`，`mode: zhanggui-embedded`，`return_to: { phase: execute, node: <task-id> }`，由根按 Red-Green-Refactor 激活后恢复本步骤；throwaway prototype 不请求。
4. 按 boundary 实现，不做与目标无关的清理。
5. 对每个 `sync_target` 使用符号 references、schema/route/config 搜索重新发现真实影响面；更新所有必要调用方。
6. 运行该行 `validation`，阅读完整结果。
7. 通过：写 `DONE`、`completed_at` 和关键 notes；更新 `PROGRESS.md` 恢复区。
   涉及安全、迁移或公开接口的高风险 task 可在标记 DONE 前返回 `StageStatus: skill-required` 与 `SkillRequest`：`name: zhanggui-requesting-code-review`，`mode: zhanggui-embedded`，`return_to: { phase: execute, node: <task-id> }`，做任务级审查。
   所有任务尚未结束时保持 `FinalizationStatus: active`。
8. 未通过：返回 `StageStatus: skill-required` 与 `SkillRequest`：`name: zhanggui-systematic-debugging`，`mode: zhanggui-embedded`，`input` 含失败证据，`return_to: { phase: execute, node: <task-id> }`；根激活 debug leaf，修复后恢复同一 task。
9. 继续下一 dependency-ready 项。

测试失败、依赖缺失或工具报错不是自动询问用户的理由。先调查并改变策略；只有工具和仓库都无法提供、且会实质改变设计的信息才升级给用户。

## Plan 漂移

- **事实漂移**：路径、调用方或命令变化，但目标/设计不变 → 更新 tracker，继续。
- **任务分解漂移**：一个任务需要拆分或新增依赖 → 保留原 id，在 notes 记录拆分，追加新行，不重排旧 id。
- **设计漂移**：接口、数据、安全或产品规则需要重新决定 -> 返回 `StageStatus: design-drift`，并把 ReturnPhase、task id、finding evidence、受影响 open nodes/owners/consensus 写入当前 `PROGRESS.md` 的 `Design Drift` 区。SPEC/EPIC 继续作为稳定设计真值，禁止重建 DESIGN。设计重新收敛后 Durable/Epic 重新读 writing-plans 原地更新 SPEC/EPIC、boundary、depends_on 和 validation，清除 drift 区，再恢复同一 task。只改事实文字、不改变设计的情况属于 fact drift。

不要继续执行已经失真的计划。

## Shape 升级

### Transient → Durable

当出现跨会话风险、任务范围增长、重复失败或需要持久化决策时：

1. 由当前 handoff 生成 `SPEC.md`。
2. 将剩余会话 plan 转成统一 `TODO.csv`。
3. 创建最小 `PROGRESS.md` 恢复区并写 `FinalizationStatus: active`。
4. 磁盘 CSV 成为真值，重新同步会话 plan。

### Durable → Epic

当一个 TODO 开始承载多个独立 deliverable 或依赖链时，升级不搬目录：`task_dir` 是 child 位置的唯一真值，既有 Durable 留在原位。

1. 创建父 `EPIC.md`、`SUBTASKS.csv`、`PROGRESS.md`，父 PROGRESS 写 `FinalizationStatus: active`。
2. 在父 `SUBTASKS.csv` 为既有 Durable 写协调行：`task_dir` 相对父 epic 目录解析（升级 child 通常为 `../<原任务目录>`，允许 `../` 但不得指向 task_root 之外），复制原目标、依赖和当前状态；child 的 TODO 行状态、SPEC、PROGRESS 和 raw 资料原样不动。
3. 在该 child 的 `PROGRESS.md` 恢复区加一行 `Parent: <父 epic 相对路径>`；冷启动据此把它当作 child，从父 `SUBTASKS.csv` 恢复，而不是独立 task。
4. 将剩余 deliverable 建成新 child（默认放在 `.tasks/<epic>/tasks/<child>/`），声明 `depends_on`；新 child 从 `TODO` 开始，其 PROGRESS 写 `FinalizationStatus: active` 和 `Parent:`。
5. 按父子状态重算规则初始化父 `SUBTASKS.csv` 与父 `PROGRESS.md`；父 CSV 成为协调真值，child TODO.csv 仍是各 child 内部真值。

## 恢复输出

跨会话恢复时先报告：

```text
Task: 一句话目标
Shape: transient | durable | epic
FinalizationStatus: none (Transient) | active | pending-validation | pending-cleanup | complete (normally not resumed)
Progress: X/Y
Current: 当前行或子任务
Truth: Transient 写 session plan；Durable 写 TODO.csv；Epic 同时写父 SUBTASKS.csv 和当前 child TODO.csv
Parent status: Epic 时报告按 child 真值重算后的父状态及任何分歧
Latest validation: 命令和结果
Next: 一个明确动作
```

## 整体完成

所有任务完成后：

1. 命中 code-review 触发条件（安全、迁移、公开接口、存量数据、跨多文件、Epic child 完成、合并/交付前）时返回 `StageStatus: skill-required` 与 `SkillRequest`：`name: zhanggui-requesting-code-review`，`mode: zhanggui-embedded`，`return_to: { phase: execute, node: <task-id> }`：Critical/Important findings 由根合并后重开或新增任务行回执行循环（此时 `FinalizationStatus` 仍为 `active`），修复并重跑对应 validation；`review-passed` 或按该 skill 规则记录跳过理由后才继续。
2. Durable/Epic 把 `FinalizationStatus` 设为 `pending-validation`；Transient 不创建该字段。随后根据会话验收或 SPEC/EPIC final validation 运行整体 smoke、相关测试、lint 或 build，只运行能证明本次声称的完整检查。
3. 返回 `StageStatus: skill-required` 与 `SkillRequest`：`name: zhanggui-verification-before-completion`，`mode: zhanggui-embedded`，`input` 含完整证据，`return_to: { phase: execute, node: <task-id> }`，由根核对需求与证据后恢复本步骤。
4. `not-verified` 记录 gaps 并回原 task/debug，Durable/Epic 保持 `pending-validation`；`verified` 恢复 execution 后，Durable/Epic 改为 `pending-cleanup`，Transient 继续完成会话交付。
5. 未被用户要求时不自行 commit、push 或创建 PR；工作在独立分支/worktree 上或用户要求收尾时，返回 `StageStatus: skill-required` 与 `SkillRequest`：`name: zhanggui-finishing-a-development-branch`，`mode: zhanggui-embedded`，`return_to: { phase: execute, node: <task-id> }`，由根呈现收尾选项并执行用户选择。
6. 项目已有 memory/archive 约定时，将关键决策、根因和坑点写入该位置；没有约定但本次产生了可复用的领域决策或坑点时，问一次是否创建轻量沉淀文件（如 `docs/DECISIONS.md`），用户拒绝则本 effort 内不再问。`SPEC.md` / `EPIC.md` 是否保留遵循项目文档约定；清理临时 raw 和无价值恢复信息。
7. Transient 确认会话 plan 全部 completed 后结束。Durable/Epic 还要确认 CSV 没有未完成/失败行且 cleanup 已结束，设置 `FinalizationStatus: complete`；只有此后才可删除临时 `TODO.csv` / `SUBTASKS.csv`。`complete` 的 PROGRESS 可按项目归档约定保留或删除。

## 输出 delta

每次把控制权交回编排 frame 时返回：

```text
TaskDelta: 本轮更新的任务行/子任务状态与关键 notes
Evidence: 最新 validation 命令与结果
ReturnPhase / ReturnNode: debug-required、design-drift、verification-required、skill-required 时必填（execute + 当前 task id）
StageStatus: finalization-complete | debug-required | design-drift | verification-required | skill-required | awaiting-user | blocked
SkillRequest: skill-required 时必填（完整 Embedded SkillRequest）
Next: 对编排器的一个建议动作
```

本 stage 不设置全局 readiness；`finalization-complete` 后由编排器结束 effort 或继续剩余工作。
