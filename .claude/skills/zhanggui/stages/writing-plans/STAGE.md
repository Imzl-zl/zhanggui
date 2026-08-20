
# Writing Plans — 只补执行层，不复制模型计划

这是 `/zhanggui` 的 supporting stage，不是独立 skill。它只在编排器已设置 `durable-plan` 或 `epic-plan` 后物化执行工件；完成后返回 plan delta，由当前编排 frame 连续进入 execution。

所有 `.tasks/...` 路径都是 `WorkflowState.task_root` 默认值的示例；项目选择其他专用根时统一替换，禁止同时写两个根。

物化前必须由编排器确认 `<task_root>/.zhanggui-root` ownership marker；本 stage 不在未标记的非空目录中创建工件。

## 先选形态

| 形态 | 条件 | 磁盘工件 | 状态真值 |
|---|---|---|---|
| **Transient** | 单会话、低风险、通常 1–5 个线性步骤，不需要恢复 | 无 | 会话内置 plan |
| **Durable** | 需要跨会话恢复、风险高、依赖较多或通常 ≥6 步 | `.tasks/<task>/SPEC.md` + `TODO.csv` + `PROGRESS.md` | `TODO.csv` |
| **Epic** | 多个独立 deliverable、明确依赖链或可并行子任务 | `.tasks/<epic>/EPIC.md` + `SUBTASKS.csv` + `PROGRESS.md` + `tasks/` | `SUBTASKS.csv` |

步骤数量只是信号。三步数据迁移可以是 Durable；八步一次性文案调整也可以是 Transient。

不要为了“记录完整”给短任务创建 CSV。不要同时创建 `.tasks`、`.codex-tasks` 和项目根 TODO。
`zhanggui` 通常会把 Transient 直接交给执行阶段；只有需要记录 shape 选择本身时，计划阶段才记录一个不落盘的 Transient 结论。

`Batch` 不再是第四种 shape：本工作流不依赖 `spawn_agents_on_csv`。同质批量工作按恢复/风险选择 Durable 或 Epic，再把可独立、写范围不冲突的行作为受控并行执行策略；不要仅因数量大就强制 Epic。

## 真值规则

- 没有磁盘 tracker 时，会话 plan 是唯一执行真值。
- SPEC/EPIC 尚未创建时，`DESIGN.md` 是设计真值。
- Cutover 时先生成候选 SPEC/EPIC、TODO/SUBTASKS 和 PROGRESS；覆盖核对完成前 DESIGN 仍胜出，禁止 yield 或执行候选计划。
- 覆盖核对通过后，把全部候选提交到最终路径并重新读取 schema、引用和覆盖结果，然后删除 DESIGN——删除是 finalization 的最后一次真值写操作，此后不得再有计划写入。只有删除成功后 SPEC/EPIC 才成为设计真值、CSV 才成为状态真值。中断发生在删除前时，恢复必须以 DESIGN 为准并重建候选工件。
- SPEC/EPIC 已存在后不得重建 DESIGN。后续 design-drift 把未决 WorkflowState 写入 PROGRESS 的 `Design Drift` 区，稳定决定仍以 SPEC/EPIC 为准；重新收敛后由本 stage 原地更新 SPEC/EPIC 和受影响任务，再清除 drift 区。
- 会话 plan 只投影 `goal` 和状态；与磁盘 CSV 分歧时以磁盘为准并立即重建镜像。

## 与模型 plan 的互补

模型 plan 保持短：展示目标和即时进度。磁盘 tracker 只补执行所需的信息：

- 只动什么、不动什么。
- 已知关联文件。
- 需要重新检查的符号、接口、schema、路由、配置、迁移、测试和文档。
- 依赖关系。
- 可执行验证。
- 状态、失败和恢复信息。

CSV 的 `goal` 是对模型目标的稳定引用，不是另一份长篇计划。对应关系只由会话 plan 侧维护：镜像重建时 plan 条目引用 CSV 行 `id`；CSV 不反向引用会话 plan 编号——会话编号跨会话不稳定，持久层不得依赖易失层。

## Durable 工件

### SPEC.md

```markdown
# [Task] Execution Spec

**Goal:** 一句话目标
**Decisions:** 已确认的产品/架构/UI 决策
**Constraints:** 版本、安全、兼容、依赖和资源约束
**Non-goals:** 明确不做的范围
**Architecture:** 2–5 句实现方向
**Final validation:** 整体完成标准
```

### TODO.csv

统一使用 RFC 4180 CSV；含逗号、换行或引号的字段必须正确引用。

```csv
id,goal,boundary,related_files,sync_targets,depends_on,status,validation,completed_at,notes
1,实现登录 API,"只改 /api/auth，不改前端",src/api/auth.ts,"symbol:UserService.login;route:POST /api/auth/login",,TODO,curl 返回 200,,JWT 24h
```

字段：

- `id`：稳定任务编号，创建后不重排。
- `goal`：一个可独立验收的目标。
- `boundary`：允许和禁止修改的范围。
- `related_files`：计划时已确认的路径；用 `;` 分隔。
- `sync_targets`：需要重新检查的契约表面，用 `kind:value`；可包含 `symbol`、`type`、`schema`、`route`、`config`、`migration`、`test`、`doc`。
- `depends_on`：依赖任务 id；多个用 `;`。
- `status`：`TODO | IN_PROGRESS | DONE | FAILED`。
- `validation`：具体命令或可观察步骤。
- `completed_at`：完成时间；未完成留空。
- `notes`：决定、失败原因、retry 或新发现。

`sync_targets` 不只是方法名。计划前用代码智能和 references 确认已知调用面；执行时必须重新查引用，不能把计划里的列表当永久事实。

### PROGRESS.md

初始只写恢复所需内容：

```markdown
# Progress

- Shape: durable
- FinalizationStatus: active
- Truth: .tasks/<task>/TODO.csv
- Current: first dependency-ready TODO row
- Latest validation: not run
- Next: start the first ready task
```

不要写长篇过程日记。只记录跨会话恢复、新决策、失败根因和 shape 变化。

`FinalizationStatus` 是固定恢复字段：`active | pending-validation | pending-cleanup | complete`。它只表示整体执行/交付阶段，不复制 CSV 行状态；CSV 仍是任务状态真值。Durable 和 Epic 父 PROGRESS 都必须写该字段。

## Epic 工件

`EPIC.md` 使用与 SPEC 相同的目标、决定、约束和最终验证，再列出 deliverable 边界。

```csv
id,goal,task_type,depends_on,task_dir,status,validation,completed_at,notes
1,实现认证 API,durable,,tasks/auth-api,TODO,API 集成测试通过,,
2,接入登录 UI,durable,1,tasks/login-ui,TODO,浏览器流程通过,,
```

每个子任务使用自己的 Durable 工件。父项只有在子任务最终验证完成后才能 DONE。

`task_dir` 相对父 epic 目录解析，是 child 位置的唯一真值：规划期新建 child 默认放在 `tasks/` 下；升级自 Durable 的 child 留在原位（通常为 `../<原任务目录>`），允许 `../` 但不得指向 task_root 之外。每个 child 的 `PROGRESS.md` 都写 `Parent: <父 epic 相对路径>`，冷启动据此不把 child 当独立 task。

## 计划流程

进入以下步骤前复核 task root：ownership 由编排器按 `RECOVERY.md` 建立，本 stage 只验证 marker 存在且版本匹配、自定义根能从项目根 `.zhanggui/config.yaml` 重新发现；复核失败返回 blocked，不在本 stage 建立 ownership。

1. 读取 WorkflowState，确认 `open_nodes` 与 `fog` 为空；存在 user-owned decisions 时还要确认 `consensus: confirmed`。
2. 确认编排器传入的 readiness 是 `durable-plan` 或 `epic-plan`；Transient 不在本 stage 落盘。
3. 选择 Durable 或 Epic，并说明一个理由。
4. 用仓库工具定位真实文件、符号和引用；不猜路径。
5. 将任务切到可独立验收且值得单独拒绝/批准的粒度。
6. 写 boundary、sync_targets、depends_on 和 validation。
7. 检查需求覆盖、依赖闭环、路径存在性、符号一致性和占位符。
8. 吸收 DESIGN checkpoint（如有），生成候选工件并完成覆盖核对。
9. 宿主有 subagent 能力时，按 [plan-document-reviewer-prompt.md](plan-document-reviewer-prompt.md) 模板派一个计划审查子代理复核候选工件（占位符映射：`PLAN_FILE_PATH` = 候选 TODO/SUBTASKS 与 SPEC/EPIC；`SPEC_FILE_PATH` = 当前设计真值 DESIGN 或既有 SPEC/EPIC）；无 subagent 能力时按其 What to Check 清单自查。`Issues Found` 在本阶段解决并重跑覆盖核对后才继续。
10. 把全部候选提交到最终路径并重新读取验证，然后删除 DESIGN；删除后不得再有计划写入。删除失败则保持 DESIGN 为真并返回 blocked。
11. 返回 `StageStatus: plan-ready`、Shape、Truth、Artifacts 和第一条 dependency-ready task；不 invoke 入口或 execution stage。

## 失败条件

计划中不得出现：

- `TBD`、`稍后补`、`适当处理`、没有对象的“写测试”。
- 未经代码搜索臆测的路径或符号。
- 依赖不存在的任务。
- 只有实现动作、没有验证的任务。
- 重大设计仍未确认却假装进入执行。

发现这些问题时在计划阶段解决，不把缺口推给执行阶段或用户。
