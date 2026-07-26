# Skill 融合工作流设计

**状态：** v0.6 权威设计文档  
**日期：** 2026-07-25  
**实现入口：** [`zhanggui/`](../README.md)

## 0. v0.6 运行架构摘要

- **Strict leaf / host root**：八个 `zhanggui-*` leaf 是严格 Agent Skills；`zhanggui` 是唯一 explicit-only host-extended 编排器，拥有 `WorkflowState`、frontier、consensus、return point、readiness 与 Embedded 合并权。
- **内部协议**：`SkillRequest` / `SkillResult` 是 Zhanggui 根拥有的内部协议，不是 Agent Skills 开放标准字段。
- **激活顺序**：native activation → catalog location → controlled collection fallback；业务路由只写 skill name + mode，不把 sibling 路径当作唯一业务接口。
- **内部 stage 只返回请求**：有状态 stage 不加载 leaf，只返回 `SkillRequest`；leaf 在 Embedded 模式返回 `SkillResult`，需要下游 skill 时写 `next_skill_request`。
- **验证命令**：automated suite、trigger eval、clean-host native activation 与 collection fallback 命令见 README「验证与验收命令」；完整 `skills/` collection 仍是唯一安装单元。

## 1. 背景

原工作区同时存在多套工作流 skill、任务清单工具、模型内置 plan 和多套 UI 设计方式。单独使用都有价值，同时启用会产生：

1. 多个入口竞争。
2. 用户不懂某领域时，模型仍把可查事实和设计问题逐项问回用户。
3. 会话 plan、多个 CSV、SPEC/PROGRESS 同时争夺真值。
4. UI 要么只能靠文字想象，要么每次都启动过重原型。
5. 原 v0.2 把内部阶段注册成 model-invoked skill，但又要求它们返回 user-only router；宿主无法强制这个 re-entry。
6. Mixed owner、prototype detour 和大而模糊设计缺少可恢复的决策依赖。
7. v0.4 把成熟的调试、TDD、验证、审查和交付过程全部藏在根 skill 内，宿主无法按窄意图独立发现或复用。

## 2. 目标

- 用户启动完整工作流时只需调用 `/zhanggui` 一次。
- 内部路由遵守宿主真实 invocation 规则。
- runtime plugin 发现一个 explicit-only host-extended 根技能与八个可独立匹配的严格 leaf skills。
- leaf 在 Direct 模式不虚构根状态，在 `Zhanggui Embedded` 模式返回可由根合并的 `SkillResult`。
- 决策 owner 可按业务、技术、UI 等领域分别设置。
- 严格 Owner/grill-me 路径保持一次一问、用户决策、明确共识。
- UI 可通过视觉原型、文字讨论或既有设计直接推进。
- 短任务不落盘；长设计和长执行都能恢复。
- 任一范围只有一个状态真值。

## 3. 非目标

- 不替用户决定业务规则、安全边界或不可逆迁移。
- 不强制每个任务创建 spec、CSV、Epic 或 HTML 原型。
- 不同时运行两套默认强编排入口。
- 不把 prototype 直接升级为未经正式流程的生产实现。
- 不把依赖共享 WorkflowState、frontier 或 readiness 的有状态 stage 暴露成独立 skill；只有能提供真实 Direct 终态契约的过程才成为 leaf。
- 不用文件行数替代行为验证；Skill/设计文档不设 300 行硬上限。

## 4. 核心设计

### 4.1 一个默认编排入口、五个内部 stage、八个 discoverable leaves

`/zhanggui` 是唯一默认强编排入口。它在一次 invocation 后保持为整个会话的 orchestration frame。

依赖共享 WorkflowState 的阶段保存在 `skills/zhanggui/stages/<name>/STAGE.md`，没有 `SKILL.md`：

- `design-assist`、`grilling`、`prototype`、`writing-plans`、`executing-plans` 只能由根按条件读取。
- stage 返回 state delta 或 `SkillRequest`；根合并 delta、重算 frontier 和 readiness，并消费全部 Embedded `SkillRequest`。
- stage 不加载 leaf、不 invoke sibling skill，也不重新 invoke `/zhanggui`。

可复用且能独立闭环的工程过程保存在 collection 内的 `skills/zhanggui-*/SKILL.md`：

- `systematic-debugging`、`test-driven-development`、`verification-before-completion`。
- `requesting-code-review` 与 `receiving-code-review`。
- `using-git-worktrees`、`dispatching-parallel-agents`、`finishing-a-development-branch`。

每个 leaf 都有宿主可匹配的 `Use when ...` description，并定义两个明确模式：

- **Direct**：从用户请求推导输入，不创建 WorkflowState、return point、tracker、readiness 或假恢复字段；在自身结果上终止。
- **Zhanggui Embedded**：只接受根提供的真实 `SkillRequest` 字段，返回局部 `SkillResult`；根仍拥有共享状态、问题分发、tracker 更新和最终完成声称。

根是唯一 Embedded `SkillRequest` 消费者，按固定顺序激活目标 skill：native activation → catalog location → controlled collection fallback。激活后校验 frontmatter `name` 与请求名一致，再按保留的 request input 执行 Embedded contract 并合并 `SkillResult`。这样既保留单一默认编排 frame，也让窄任务能被宿主独立发现；leaf 不是要求用户手工接力的一组主线命令。

完整可移植单元因此是整个 `skills/` collection，而不再只是 `skills/zhanggui/`。裸安装必须复制根与八个 leaf 并保持 collection 布局。

task-root ownership 与冷启动恢复细则仍位于根旁的 `RECOVERY.md`，只在第一次写盘前或存在恢复候选信号时读取；它不参与 discovery。Agent Skills 的渐进加载保证启动时只注入九个 frontmatter，实际匹配后才加载正文，未使用的 stage/leaf 不占完整上下文。

### 4.2 决策分权，而不是用户画像

路由单位是当前 decision node。每个 node 只有一个 owner：

- `model`：模型研究并决定当前节点。
- `user`：用户通过 grilling 决定当前节点。

`Assisted | Owner | Mixed` 描述 owner 分配方式，不是永久用户标签。

部分 Owner 声明只覆盖点名领域，未点名领域默认 model-owned；只有全局所有权声明才把全部领域转为 user。已 ready node 的 owner 信号冲突时只问该节点一次。

Assisted 中，模型解决事实、既定约定和明显优解；长期权衡、公开接口、存量数据、安全/隐私/资金、不可逆迁移以及未知资源约束转为 user-owned node。

Owner 中，只有事实和已定结论可跳过。剩余真实 decision node 无论大小都必须一次一问，或先显式转为 owner=model；不能用“低风险”静默替用户回答。

### 4.3 全局 frontier 保证 Mixed 一致性

入口维护一棵全局 decision graph：

- node 有稳定 id、domain、owner、question、depends_on 和 status。
- 只有依赖关闭的 node 可以进入 ready frontier。
- design-assist、grilling 和 prototype 只返回当前 node delta。
- 局部领域完成不产生全局 plan/execute readiness。
- 任一 user-owned branch 活跃时，全工作流每轮最多问用户一个问题；决策问题与元问题（模式、UI mode、worktree、恢复候选、沉淀文件）共用该节奏，可延迟的元问题延后到必须决定时再问。

因此业务 Owner + UI Assisted、业务 Assisted + UI Owner 等组合不会丢失另一个领域，也不会同时塞给用户一批问题。

### 4.4 事实自查，决策才问

能从仓库、环境、配置、文档、官方资料和同类项目查到的事实由模型查。重大不等于必须问；如果项目事实已固定答案，继续提问只制造仪式感。

模型默认只适用于 model-owned node。user-owned node 的任何真实选择都必须等待用户回答。

### 4.5 共识是硬门

只要本轮存在 user-owned decisions：

1. 全部 design nodes 和 fog 关闭后，模型复述完整决策链、assumptions、rejected branches 和边界。
2. 状态设为 `consensus: pending`。
3. 用户明确确认后变为 `confirmed`。

树关闭不等于共识确认。`pending` 时 readiness 仍为 `continue-design`。

### 4.6 UI 是独立轴

`Prototype-Assisted | Design-Owner | Direct | Text-Only` 与业务 owner 正交：

- Prototype-Assisted：视觉证据可减少不确定性时做原型，owner 不自动改变。
- Design-Owner：UI node 讨论优先，既有 owner 决定使用 grilling 或 design-assist。
- Direct：已有稿件/设计系统时直接解决 UI nodes。
- Text-Only：明确不做原型。

UI mode 使用确定性信号优先级：已有终稿照稿实现为 Direct；明确不要原型为 Text-Only；明确先看原型/多版方案为 Prototype-Assisted；用户保留 UI owner 且要求逐项讨论、未要求原型时为 Design-Owner；Assisted 用户无法凭文字判断真实视觉问题时默认 Prototype-Assisted。只有冲突信号会改变成本时才问一次。mode 只决定证据/交互形式，不偷偷改变 owner。

### 4.7 Prototype 是 parent node 的证据

每个 prototype 必须有 `ParentDecisionId`、Question 和 SuccessSignal。返回 artifact、pending/answered、result、rejected。入口只更新 parent node 和 prototype state，不丢失其他领域状态，也不让 prototype 设置全局 readiness。

真实导航、权限、数据密度会改变判断时使用项目 dev-only 集成原型；否则使用独立 HTML。两个宿主是条件分支，不是双默认。

### 4.8 Fog discovery 是可执行循环

大而模糊工作先确认 destination（destination 本身不明时，先用开放问题逐轮收敛出它），再 breadth-first 映射：

- 可准确表述的问题形成 node。
- 已知在范围内、暂时说不清的问题留在 fog。
- ready nodes 按 owner 走 research/design-assist/grilling/prototype。
- 每个结果更新 graph 和 fog。

只有 destination/成功标准、scope/non-goals/约束清楚，fog 和 nodes 清空，验证目标已知时才毕业。扫描证明任务实际很小时降级为普通 design/Transient，已创建的 DESIGN.md 按用户意愿删除或保留。discovery 产生决定，不生产实现。

### 4.9 持久化按恢复价值付费

设计和执行分别只有一个真值：

| 阶段 | 短工作 | 需要恢复 |
|---|---|---|
| Pre-plan Design | 会话 WorkflowState | `.tasks/<task>/DESIGN.md` |
| Post-plan Design | SPEC/EPIC | PROGRESS 中的临时 `Design Drift` state |
| Execute | 会话 plan | Durable `TODO.csv` / Epic 父子 CSV |

DESIGN→SPEC/EPIC 是单次 cutover：候选工件核对期间 DESIGN 仍胜出且不能执行；核对通过后同次 finalization 删除 DESIGN，删除成功才切换真值。SPEC/EPIC 已存在后不重建 DESIGN，design-drift 在 PROGRESS 恢复，收敛后原地更新计划。

冷启动在意图路由前恢复设计和执行。候选根来自显式 checkpoint、项目根 `.zhanggui/config.yaml`，以及带 `.zhanggui-root` marker 的 `.tasks/` / `.zhanggui/tasks/`；无 marker 的非空根不自动采用。对同一 task，真值优先序为：DESIGN（即使候选 SPEC/EPIC 已存在）→ active Design Drift → CSV 非终态或 `FinalizationStatus` 为 active/pending-validation/pending-cleanup 的 Durable/Epic tracker。`complete` 且已归档/删除的 tracker 不再恢复。多个 task 无法唯一判定时只问一次。

### 4.10 引导式提问与收敛循环

所有向用户的决策问题统一为引导式格式：问题 + 研究背景（同类设计 > 官方指南 > 模型自身判断，无同类时标注）+ 2-4 个带差异的选项 + 明确推荐 + 自由输入出口。用户独有信息用开放问题，不硬造选项。格式随熟悉度伸缩：陌生领域（Assisted 卡点）用完整引导式，用户熟悉的 Owner 领域以开放问题 + 推荐为主、选项按需；格式只统一"怎么问"，不改变 owner 分权（问多少、谁决定）。

问题内容与交付通道分离：所有等待用户的路径先构造统一 `QuestionRequest`（question、context、options、recommended、free_form），再由编排器检查当前宿主暴露的能力。`AskUserQuestion`、`request_user_input`、`ask` 或等价结构化工具能忠实表达请求时必须真实调用，不能用普通消息里的编号菜单替代；推荐项使用原生元数据，宿主自动提供的 `Other` / 自定义输入直接承担自由输入出口，不重复造选项。

只有宿主没有原生结构化提问能力，或工具 schema 无法表达不带伪造选项的纯开放问题时，才允许文字提问，并以 `no-native-question-tool` 或 `unsupported-question-shape` 显式记录降级。Skill 只能强制使用已存在的宿主能力，不能为不提供该能力的客户端制造弹框。


用户自由输入是一等回答：明确决定关闭节点；想法/方向触发收敛循环——复述理解、补研究、更新选项后继续一次一问直到收敛，不受"仪式性追问限一次"约束。design-assist 转出的 user-owned 卡点必须把研究与选项预填进 node，grilling 复用不重做。

### 4.11 运行时鲁棒性

规则密度本身是执行风险：单次推理无法同时兼顾所有硬约束。因此入口维护核心纪律优先级列表（用户所有权 > 单一真值 > 共识/验证硬门 > 一次一问 > 状态可恢复），规则冲突或无法兼顾时按列表裁决，不靠逐条权衡；Minimal→Full 投影升级绑定机械触发点而非软判断。

用户明确放弃当前目标或方向大变时执行 scope reset：剪枝全部 nodes/fog、作废受影响 decisions、按失效规则重置 consensus、从新目标重新路由；已落盘 DESIGN.md 按用户意愿删除或保留。

## 5. 总体架构

```text
user invokes /zhanggui once
  |
  +-- resume DESIGN/drift/tracker --> hydrate truth --> prior node/task/phase
  +-- answer/research/review ----------------------> stop
  +-- bug ----------------> debug --return point---> prior phase
  +-- executable plan -----------------------------> execute
  +-- partial plan -------> readiness check --------> design|plan|execute
  +-- idea/fog ------------------------------------> new WorkflowState
                                                       |
                                      global ready frontier
                                       /       |       \
                            model node     user node    evidence node
                           design-assist    grilling      prototype
                                       \       |       /
                                         state delta
                                             |
                            continue-design | stop | transient | durable | epic
                                             |
                                      plan / TDD / execute
                                             |
                                          verify
```

## 6. WorkflowState

权威字段：

```text
version
goal / intent / phase / constraints / non_goals
decision_mode / owners{domain -> model|user} / ui_mode
decisions{id, domain, owner, decision, reason}
assumptions{id, domain, assumption, reversible}
open_nodes{id, domain, owner, question, depends_on, status} / fog
prototype{parent_id, status, artifact, result}
current_node / awaiting
return_point{phase, node, evidence_ref}
consensus: not-required | pending | confirmed
readiness: continue-design | stop | transient-execution | durable-plan | epic-plan
task_root / next / checkpoint
```

每次等待用户、owner/prototype/debug/verification detour 和 stage return 前先更新 state。只有入口能设置 readiness；return point 在恢复原节点并合并成功后才清空。

每次把 `awaiting` 置为非 `none` 前，向会话输出 ≤10 行压缩 state 块作为软 checkpoint。`DESIGN.md` 落盘由机械条件触发：fog 非空、两次用户等待后 frontier 仍未清空，或用户暂停/handoff；不依赖对"会话是否会中断"的预判。

`return_point` 是单槽且 detour 不嵌套：非空时不得覆盖。当前 debugging/verification/design-drift 必须先返回、合并并恢复原 node，后续 detour 才能启动；detour 内发现的新失败作为当前 stage 的 evidence/gap 处理。

Minimal 投影只含 `goal / intent / phase / readiness / next`，用于问答、评审和无需设计的 Transient。完整字段只在 Design/Discovery、prototype、跨会话或 detour 中启用；升级由机械触发点决定——新建 node/fog、写 return_point、写任务工件、phase 进入 design/discovery/prototype 前必须补齐，不做软判断。

## 7. Supporting procedure 接口

| Procedure | 输入 | 局部输出 |
|---|---|---|
| design-assist stage | 完整 state + model node | resolved/new/pruned/ownership/prototype request |
| grilling stage | 完整 state + user node | one question 或 user decision delta |
| prototype stage | 完整 state + parent id + success signal | artifact/result/status |
| writing-plans stage | settled state + durable/epic readiness | artifacts + plan-ready |
| executing-plans stage | plan/tracker + task | task status/debug/design/verify request |
| test-driven-development leaf | task + observable contract | Red/Green/Refactor evidence |
| systematic-debugging leaf | evidence + return_point | root cause/change/validation/return point |
| verification-before-completion leaf | claim + acceptance + evidence + return_point | verified/not-verified + return target |
| requesting/receiving-code-review leaves | scope/feedback + contract + return fields | strengths/findings/verdict 或反馈处理 delta |
| finishing-a-development-branch leaf | verified 结论 + branch/workspace 状态 | 用户选项执行结果 + cleanup 状态 |
| using-git-worktrees leaf | 隔离触发条件 | workspace/baseline + isolated/in-place |
| dispatching-parallel-agents leaf | 独立域划分 + 每 agent scope | 派发计划/结果核实/冲突/集成验证 |

内部 stage 只返回局部 delta 或 `SkillRequest`；leaf 的 `Zhanggui Embedded` 模式返回 `SkillResult`，不创建新的全局 ledger；leaf 的 Direct 模式按自身 Completion Contract 终止。
design-drift 必须重开受影响 nodes，并按全局规则使旧 consensus 失效；设计收敛、重新 recap（如需）和 planning 后才能恢复原 execution task。任何新增/重开 node 或 fog 都把 confirmed 重置为 pending（仍有 user-owned decisions）或 not-required（没有）；只改事实文字属于 fact drift。

## 8. Readiness

入口按顺序计算：

1. nodes/fog 非空，或本轮存在 user-owned decisions 且 consensus != confirmed -> `continue-design`
2. 只要求研究/评审/设计且交付满足 -> `stop`
3. 单会话低风险 -> `transient-execution`
4. 需要恢复、高风险或依赖较多 -> `durable-plan`
5. 多 deliverable/依赖链 -> `epic-plan`

Assisted 产生用户卡点时同样留在 continue-design。

## 9. 执行数据模型

### Durable

```text
.tasks/<task>/
├── SPEC.md
├── TODO.csv
├── PROGRESS.md
└── raw/        # 可选
```

```csv
id,goal,boundary,related_files,sync_targets,depends_on,status,validation,completed_at,notes
```

`sync_targets` 覆盖 symbol、type、schema、route、config、migration、test、doc。计划影响面只是快照；执行必须重新做 references/search。

### Epic

父 `SUBTASKS.csv` 是协调真值，child `TODO.csv` 是子任务内部真值。父状态由 child truth 重算；不反向覆盖 child。

`task_dir`（相对父 epic 目录）是 child 位置的唯一真值：新建 child 默认在 `tasks/` 下；Durable→Epic 升级不搬目录，既有 child 留在原位，`PROGRESS.md` 写 `Parent:` 回指父 epic，冷启动据此不把 child 当独立 task。

### 状态

```text
TODO -> IN_PROGRESS -> DONE
                   \-> FAILED -> IN_PROGRESS
```

DONE 必须有当前 validation 的新鲜证据。

`PROGRESS.md` 的固定整体恢复字段为 `FinalizationStatus: active | pending-validation | pending-cleanup | complete`。它不复制任务状态：Durable `TODO.csv`、Epic 父子 CSV 仍分别是真值。所有行完成后先进入 pending-validation，验证通过后进入 pending-cleanup，清理结束才 complete。

## 10. Invocation 与隔离

- plugin 发现 `zhanggui/SKILL.md` 与八个严格 leaf；只有根同时设置 Claude `disable-model-invocation: true` 与 Codex `allow_implicit_invocation: false`。
- 根的 explicit-only 是有意取舍：避免普通问答被重工作流接管。用户启动完整流程后不需要再次输入命令。
- leaf 不设置 model-invocation 禁用项；宿主可按 `Use when ...` description 匹配其 Direct 模式。根则通过 `SkillRequest` 激活同一 leaf 的 `Zhanggui Embedded` 模式。
- 完整 collection 自包含：插件安装加载 `./skills/`；裸安装必须把 `zhanggui/` 与全部 `zhanggui-*` 目录一起复制并保持 collection 布局。Agent Skills 渐进加载保证未使用的正文不进上下文；插件与裸 collection 不得同时启用。
- 五个共享状态阶段仍是 `STAGE.md`，不参与 discovery，只返回 `SkillRequest`；`RECOVERY.md` 同样只由根按需读取。
- 不得同时启用另一套默认强编排入口。
- clean-host acceptance 以 OMP JSONL 事件为证据：native 路径记录 `skill://` 读取；fallback 路径在 `--no-skills` 下记录受控 collection 文件读取与 frontmatter 身份校验。

### 10.1 Batch 与任务命名空间

Batch 不再是 shape：同质批量是 Durable/Epic 内的执行并行策略，不使用 `spawn_agents_on_csv`，也不因数量大强制 Epic。task root ownership 由 `<task_root>/.zhanggui-root` marker 判定；自定义根由项目根 `.zhanggui/config.yaml` 的 `version` + 项目内相对 `task_root` 声明。默认根不可采用且无 config 时才用 `.zhanggui/tasks/`。无 marker 的非空根与 `.codex-tasks/` 只作显式采用/迁移候选，禁止静默复用或双写。

### 10.2 文档规模

300 行只可作为生产代码拆分信号。Skill、STAGE、设计和参考文档以语义完整、可发现和 progressive disclosure 为准，不设硬行数上限。

## 11. 被否决方案

### 有状态内部 stage 直接注册为 model-invoked SKILL.md

否决：依赖 active handoff、共享 WorkflowState 或返回 user-only router 的 stage 只能靠 description 软门禁，工作流外会误触发，宿主也无法强制 re-entry。

这不排斥当前 dual-mode leaves：leaf 的 Direct 模式能在没有根 frame 时真实终结窄任务，Embedded 模式由根按 `SkillRequest` 激活且不夺取共享状态所有权。

### 多个 user-invoked 命令接力

否决作为默认主线：用户不应反复输入 planning/execution 命令。leaf 的独立调用是可选窄入口，不是 `/zhanggui` 阶段接力。

### Flat handoff

只传 Decisions/Assumptions/Open blockers/UI result 无法恢复依赖、owner、UI mode、prototype parent 和 consensus。改为完整 WorkflowState + node delta。

### 全局小白/大佬标签

否决：用户在不同领域的专业度和控制偏好不同。

### 所有 UI 默认 HTML

否决：已有明确设计或局部修改时，原型成本高于信息收益。

### 所有多步任务创建 CSV

否决：复制模型计划并污染仓库；短任务没有恢复价值。

### 两个默认插件同时启用

否决：重名 skill 和两个强入口没有确定解析顺序。

## 12. 验收场景

1. “我什么都不懂，你先设计” -> Assisted；查事实和同类，仅重大卡点转 user。
2. 业务 Owner + UI Prototype-Assisted -> Mixed，全局一次一问，prototype 不丢业务 state。
3. 业务 Assisted + UI owner:user + Design-Owner -> 只让 UI nodes 走 grilling，不把全流程切换 owner。
4. “不要原型” -> Text-Only。
5. 只比较布局 -> parent node 和全局 frontier 关闭后 stop。
6. Owner 领域小决策 -> 必须问或显式转 model，不静默默认。
7. 全部 nodes 关闭但未确认 recap -> continue-design。
8. 长 grilling / fog effort 中断 -> 新 session hydrate DESIGN.md，恢复 dependencies、owners、ui mode、prototype、consensus 和 return point。
9. 设计/执行/验证 detour -> 保存 return point；design-drift 重开节点并重新 planning 后回原 task。
10. 部分计划 -> readiness check，不直接执行。
11. 短改动 -> Transient，无持久 CSV。
12. 高风险/跨会话 -> Durable；多 deliverable -> Epic。
13. 生产实现 -> TDD；throwaway prototype 排除；原型逻辑 lift 进生产走受控入口——先在生产模块写失败测试再接入，不以原型期验证抵扣。
14. 完成声称 -> verification 使用新鲜证据。
15. 运行 plugin discovery -> 发现 explicit-only `zhanggui` 与八个 dual-mode leaf；五个有状态 stage 不出现。
16. Transient 小改 -> 只建立 minimal state，不生成空 decision graph。
17. DESIGN cutover 中断 -> 删除前 DESIGN 仍胜出；SPEC 已存在后的 drift 只用 SPEC + PROGRESS。
18. 冷启动有普通未完成 Durable/Epic -> 从 SPEC/EPIC + CSV + PROGRESS 恢复 execution。
19. DESIGN 与候选 SPEC 并存 -> DESIGN 胜出并重建候选，不能直接执行。
20. confirmed 后重开 node -> consensus 失效，重新 recap 前 continue-design。
21. 同质批量 -> Durable/Epic 内受控并行，不出现 Batch 第四真值。
22. 非空根无 `.zhanggui-root` -> 不自动采用；按 config/fallback/一次询问处理。
23. CSV 全 DONE 但 FinalizationStatus=pending-validation -> 恢复 final validation，不误判完成。
24. 高风险改动整体完成 -> code-review 先于 verification；Critical/Important findings 回任务循环修复并重跑 validation。
25. verified 后在独立分支/worktree -> finishing 构造稳定 choice id 的 4/3 选项；宿主有原生结构化提问能力时真实调用，由用户选择，`push-pr` / `keep` 不清理 worktree。
26. 并行派发 -> 子代理报告不作真值，经 diff + validation 核实后由主编排更新 CSV。
27. 评审请求且不改文件 -> 按 code-review 检查单出报告，minimal state，报告后 stop。
28. 无领域声明的 "grill me"/"逐项问我" -> 视为全领域声明，全部领域 `owner:user` 逐项一次一问，不落入"未声明默认 model"。
29. 用户带明确新目标冷启动且项目存在旧非终态 task -> 不为恢复提问，按新意图直接路由，首轮回复附一句可恢复提示。
30. 整体验证 not-verified -> 恢复原 task 并清空 return point，后续 debug detour 可正常写入单槽，不死锁。
31. Assisted 关键卡点转 user -> 问题带同类参考背景、2-4 个选项、明确推荐与自由输入出口；grilling 复用 design-assist 预填研究，不重做。
32. 用户不选任何选项、只输入想法 -> 进入收敛循环：复述理解、更新选项与推荐、继续一次一问直到明确决定，不被"追问一次"掐断。
33. 已进入 plan/execute 才发现存在 user-owned decisions 且 consensus != confirmed -> 立即停止、回 design 补 recap，不以"已经开始"为由继续。
34. Minimal 投影下命中完整 state 触发点（写 return_point、新建 node/fog、写任务工件）-> 先补齐完整字段再执行该动作。
35. 一轮中误发多个问题 -> 用户任答其一后，其余问题重新入队按节奏逐轮问，不并行追问。
36. 用户中途明确放弃目标 -> 执行 scope reset：剪枝 nodes/fog、作废受影响 decisions、重置 consensus、重新路由，DESIGN.md 按用户意愿处理。
37. 宿主暴露可表达当前选项的原生结构化提问工具 -> 实际发生一次宿主可识别的 tool call event，推荐使用原生字段，自动 `Other` 不重复添加，assistant 文本不再出现等价编号菜单；只输出工具名、JSON 或伪调用同样判失败；grilling、共识确认和 finishing 均适用。
38. 宿主没有原生提问工具，或纯开放问题无法被其 schema 忠实表达 -> 记录明确 fallback reason 后只问一个文字问题，不伪造选项，不静默假装已弹框。
39. Detached HEAD 的 finishing 选项删除 `local-merge` -> `recommended` 只能是仍存在的 `push-pr` 或 `keep`；无 PR 流程时推荐 `keep`，不得生成 schema 无效的推荐 id。
40. finishing 收到无法等价到四个稳定 id 的自由输入 -> 保持同一 `finishing-choice` 未决并进入收敛循环；收敛前无动作、无临时第五 id，最终 `Choice` 仍是稳定 id。
41. Direct leaf 在没有 Zhanggui frame 时 -> 从请求推导输入，不创建 WorkflowState/return point/readiness/tracker，输出自身终态。
42. 同一 leaf 由根以 `Zhanggui Embedded` 加载 -> 只消费根提供的真实字段并返回 delta；根继续拥有共享状态、问题分发和完成声称。

## 13. 演进规则
新增路由、stage 或 leaf 前必须回答：
1. 它解决的是新意图、新决策纪律，还是已有过程实现细节？
2. 它是否依赖共享 WorkflowState、frontier、readiness、return point 或 tracker 所有权？依赖则保持内部 stage。
3. 它能否在没有根 frame 时提供不造状态的真实 Direct 终态，同时在 Embedded 模式只返回 delta？不能则不建 leaf。
4. 是否会创建第二个状态真值？
5. 是否会丢失 decision id、dependencies、owner、UI mode、consensus 或 return point？
6. 是否把可查事实重新问给用户？
7. 是否有失败场景证明当前设计不足，并有 discovery、Direct、Embedded 和路径解析验证？
不能明确回答时不新增入口。默认强编排器保持唯一，有状态 stage 保持局部并只返回请求，leaf 保持双模式与无状态所有权。
