---
name: zhanggui
description: Use when starting any development effort - an idea, bug, plan, review, or ambiguous work - to route it through design, planning, execution, and verification inside one session frame.
disable-model-invocation: true
---

# Zhanggui（掌柜）- 有状态编排器

用户只调用一次 `/zhanggui`。本 skill 是整个会话唯一拥有 `WorkflowState`、decision frontier、consensus、return point 和最终 readiness 的编排 frame。有状态设计/计划/执行步骤保留为内部 `STAGE.md`；可独立闭环的过程以 sibling leaf skill 暴露，直接调用时自行结束，由本编排器加载时只按 `Zhanggui Embedded` 契约返回局部 delta。

## 核心纪律优先级

本文件与各 supporting procedure 的规则发生冲突、或同一轮命中多条规则无法兼顾时，按下表小序号胜出裁决，不逐条权衡：

1. **用户所有权**：user-owned decision 未经用户回答不得替用户决定；推荐只是信息，不是默认答案。user-owned 领域内拿不准是可查事实还是真实决策时，按决策处理。
2. **单一真值**：任一范围只有一个状态真值；候选、镜像或会话记忆与真值分歧时以真值为准。
3. **硬门**：存在 user-owned decisions 且 `consensus != confirmed` 时不得 planning/execute；无新鲜验证证据不得声称完成。
4. **一次一问**：每轮等待最多一个用户问题；提问格式的完整性让位于节奏。
5. **状态可恢复**：等待、detour 和落盘触发点前先更新 state；无法两全时，先保住可恢复性再继续推进。

## 宿主调用契约

### 文件定位

完整运行单元是 plugin 的整个 `skills/` collection：`zhanggui/SKILL.md`、`zhanggui/stages/`、`zhanggui/RECOVERY.md` 以及 Stage 导航表引用的 sibling leaf skill 缺一不可。`stages/...`、`RECOVERY.md` 相对**本 SKILL.md 所在目录**（下称 `<skill-dir>`）解析；`../zhanggui-.../SKILL.md` 也从 `<skill-dir>` 解析。与项目根和当前工作目录无关，访问前先拼出绝对路径。

首次需要读取 supporting procedure 时按以下顺序确定 `<skill-dir>`：候选目录必须真实存在 `stages/` 才算命中（宿主注入的内容镜像可能不带文件包），否则继续下一序；命中后本会话内复用，不重复探测：

1. 宿主加载本 skill 时提供的位置信息（base directory、skill 文件路径或等价字段）。
2. 搜索特征路径 `**/stages/grilling/STAGE.md`：范围为项目根与用户主目录下的 skills 安装位置（`.agents/skills/`、`.claude/skills/`、`.codex/skills/`、`.gemini/skills/`、`.trae/skills/` 等宿主自有 skills/插件目录）。命中后回退两级得到候选目录，其中须存在 frontmatter 为 `name: zhanggui` 的 `SKILL.md`，该候选目录即 `<skill-dir>`。多处命中时优先项目根下的安装，其次用户主目录；同一优先级仍有多处时按一次一问请用户指定。
3. 均未命中时报告"找不到 zhanggui 的 supporting procedure 文件，无法按检查单执行"，并按一次一问节奏请用户给出完整 skills collection 的安装路径。仅当用户明确表示不提供时，才在**显式声明降级**后以本文件已加载的编排规则加通用实践继续；禁止静默降级，禁止把降级输出当作按检查单执行的结果。

### Supporting procedure 加载

- Stage 导航表中的路径是唯一加载位置：有状态步骤读取 `stages/<stage>/STAGE.md`；dual-mode leaf 读取 `../zhanggui-.../SKILL.md` 并强制使用其中 `Zhanggui Embedded` 契约。不要靠名称猜路径。
- 编排器读取 leaf 文件是当前 frame 内的 procedure load，不是新的 user command，也不依赖宿主提供 nested skill call/return stack。
- supporting procedure 返回局部 delta 后由当前 frame 合并。task-root 与冷启动恢复细则在需要时读取同目录 `RECOVERY.md`，不常驻。
- “返回编排器”表示继续执行已加载的本文件，绝不再次 invoke `/zhanggui`，也不要求用户输入下一条 slash command。
- supporting procedure 不直接路由 sibling；它只能返回自己的状态和下一动作建议，实际 phase、return point 和 readiness 由本编排器决定。

## WorkflowState - 唯一设计状态

路由、等待用户、切换 owner、进入原型和阶段返回前，先更新同一个 `WorkflowState`：

```yaml
version: zhanggui/v0.4
goal: 一句话目标
intent: resume | answer | research | review | bug | executable-plan | partial-plan | clear-change | idea | fog
phase: route | discovery | design | prototype | plan | execute | debug | verify | stop   # route 兼作编排器层直接处理（问答/研究/评审/可执行性检查）的工作 phase，这类工作不进入专门阶段，完成后进 stop
constraints: []
non_goals: []              # 本 effort 明确排除的范围；物化时进入 SPEC/EPIC 的 Non-goals
decision_mode: Assisted | Owner | Mixed
owners:                    # 只列当前范围内的领域
  business: model | user
  architecture: model | user
  ui: model | user
ui_mode: Prototype-Assisted | Design-Owner | Direct | Text-Only | not-applicable
decisions:                 # id 创建后不复用
  - { id: D1, domain: business, owner: user, decision: "...", reason: "..." }
assumptions:
  - { id: A1, domain: architecture, assumption: "...", reversible: true }
open_nodes:
  - { id: D2, domain: ui, owner: user, question: "...", depends_on: [D1], status: blocked }
fog: []                    # 已知在范围内、但还不能准确表述的问题
prototype:
  parent_id: null
  status: none | pending | answered
  artifact: null
  result: null
current_node: null
awaiting: none | user | prototype | debug | verification
return_point:
  phase: null
  node: null
  evidence_ref: null
consensus: not-required | pending | confirmed
readiness: continue-design | stop | transient-execution | durable-plan | epic-plan
next: 一个明确动作
task_root: .tasks
checkpoint: session | <task_root>/<task>/DESIGN.md | <task_root>/<task>/PROGRESS.md#design-drift | <task_root>/<task>/TODO.csv | <task_root>/<epic>/SUBTASKS.csv
```

规则：

1. `open_nodes` 保存所有未决设计，不只保存“重大”问题；依赖满足的节点才标为 `ready`。
2. `owners` 和 `ui_mode` 是恢复字段，不能只埋在自由文本结论里。
3. stage 返回 delta 后由编排器合并、剪枝和重算 ready frontier；不得用局部 stage 结果覆盖全局 state。
4. 只有编排器可以设置最终 `readiness`。
5. 每次把 `awaiting` 置为非 `none` 前更新 state 并输出压缩 state 块（定义见"跨会话设计检查点"）；不要等到访谈结束才第一次形成 handoff。
6. `current_node`、`awaiting` 和 `return_point` 是恢复字段；任何 detour 或等待都必须写入 checkpoint，返回原节点并成功合并后才清空。

### 状态投影

- 问答、研究、评审和无需设计的 Transient 只保留 `goal`、`intent`、`phase`、`readiness`、`next`；不要填写空的 owner/UI/decision/prototype 字段。
- idea、fog、design、prototype、跨会话工作和任何 detour 使用完整 WorkflowState。
- 升级为完整 state 由机械触发点决定，不做软判断：新建 open_node 或 fog、写 return_point、写任何任务工件、phase 进入 design/discovery/prototype——任一动作执行前必须先补齐完整字段。不要提前让简单任务承担完整 state 成本。

### 跨会话设计检查点

每次把 `awaiting` 置为非 `none` 前，先在会话中输出一个 ≤10 行的压缩 state 块（goal、readiness、decisions/open_nodes 的 id 级摘要、awaiting、next）。它是能穿越上下文压缩的软 checkpoint，也是 state 仍在被维护的自检信号。

短设计只用会话 state，不创建文件。满足任一机械条件时，把完整 state 写入 `<task_root>/<task>/DESIGN.md`，不依赖对"会话是否会中断"的预判：

- `fog` 非空。
- 本 effort 已发生 2 次 `awaiting: user`（含 prototype 等待）且 frontier 仍未清空——第 3 次等待前必须已落盘。
- 用户暂停、要求 handoff，或明确切换话题。

effort 以 `stop` 结束且从未进入 planning 时，按用户意愿删除或保留已无恢复价值的 DESIGN.md。第一次写盘前必须按 `RECOVERY.md` 的规则确认 task-root ownership；未确认 ownership 不创建任何任务工件。

DESIGN 尚未物化时是设计真值。planning 采用单次 cutover：候选工件核对期间 DESIGN 仍胜出；删除 DESIGN 成功后 SPEC/EPIC 才接管。SPEC/EPIC 已存在后不得重建 DESIGN，design-drift 改写 PROGRESS。

### 冷启动恢复

每次新的 `/zhanggui` invocation 在重新分类意图前做恢复探测：用户给出 checkpoint，或按信号（项目根 `.zhanggui/config.yaml`、带 `.zhanggui-root` marker 的默认 `.tasks/` 或后备 `.zhanggui/tasks/`）定位到的 task root 内**存在非终态真值文件**（`DESIGN.md`、active `Design Drift`、非终态 CSV tracker）——满足才读取 `RECOVERY.md` 并按其流程 hydrate。config 或 marker 存在但没有任何非终态真值时不读 `RECOVERY.md`，直接进入普通意图分类。

用户请求已含明确新目标且不匹配任何恢复候选时，不为恢复提问：直接按新意图路由，只在首轮回复附一句可恢复任务提示。同一 task 的真值优先序固定为：`DESIGN.md` → PROGRESS 中 active `Design Drift` → 非终态 CSV tracker。

没有可恢复候选才进入普通意图分类。

## 第 0 级 - 意图路由

能从请求和仓库事实判断时直接路由，不为路由本身提问。

| 情况 | 动作 | 初始阶段 |
|---|---|---|
| 继续/恢复、提供 checkpoint，或存在活动 tracker | 按冷启动优先序 hydrate 设计/drift/execution 真值 | checkpoint 对应 phase |
| 问答、研究、解释、评审且不改文件 | 直接处理，不建 tracker；代码评审请求按 `code-review` stage 检查单出报告；完成后 `stop` | route |
| Bug、测试失败、异常行为 | 保存 return point；读取 `../zhanggui-systematic-debugging/SKILL.md` 的 `Zhanggui Embedded` 模式 | debug |
| 已有可执行计划或明确任务清单 | 复用现有真值，不新建第二套 | execute |
| 部分计划、笔记或不完整 TODO | 先做可执行性检查 | route |
| 目标明确、局部、无重大设计 | 建 Transient 会话 plan | execute |
| 新想法、新功能、行为变化 | 建 WorkflowState，进入决策分流 | design |
| 大而模糊、无法在一个会话看清路径 | 进入发现循环 | discovery |

已有计划同时满足以下条件才直接执行：

1. 目标、边界和完成标准明确。
2. `open_nodes` 和 `fog` 为空，不存在未决产品、架构、安全、数据或 UI 决策。
3. 依赖、第一步和验证方式足以执行。
4. 本 effort 有任何 `owner:user` decision 时，`consensus: confirmed`；缺失或过期则先回 recap，不直接执行。

用户提供的计划、笔记或 TODO 中已写明的决策按 `owner:user` 录入 `decisions`（reason 标注来源文档）；模型为补全缺口做出的推断录为 `assumptions`。缺设计回 `design`；只缺执行字段才读 `writing-plans`。不要把半成品计划伪装成可执行计划。

### 任意阶段的 Debug / Verification detour

进入 detour 前写 `return_point.phase`、`return_point.node`、`return_point.evidence_ref`，并设置 `awaiting`：

同一时刻只允许一个 active detour。`return_point` 非空时禁止覆盖；当前 debugging/verification/design-drift 必须先把 delta 合并回保存的 phase/node，再允许发起下一 detour。detour 内发现的新失败由当前 stage 处理或作为 gap 返回，不能另开一层 return point。code-review 是执行/路由的同步子步骤，不是 detour，不占用 `return_point` 单槽。

- debug `resolved` -> 合并证据后恢复 return point；design/prototype 不强制进入执行，execute 回原 task。
- debug `blocked` / `architecture-review-required` -> 保留 return point，不得伪装继续。
- verification `verified` -> 允许对应声称，清空 return point。
- verification `not-verified` -> 合并 Gaps、恢复 return point 对应的 decision/prototype/task/validation 后**同样清空 return point**，不得声称完成；后续 debug 等 detour 按正常单槽规则重新写入。
- 顶层 bug 请求在修复后继续其 Transient/Durable/Epic 执行路径。

### 提问节奏总闸

决策问题和元问题（决策模式、UI mode、worktree 同意、恢复候选、沉淀文件等）共用同一节奏：**每轮等待最多向用户提出一个问题**。约束方式：

1. 能从既有信号、仓库事实或本文件默认值判定的元问题不问。
2. 可延迟的元问题（worktree、沉淀文件）延迟到必须决定时再问，不在开局堆积。
3. 同一时刻多个问题都必需时，按阻塞程度只问最先必需的一个，其余顺延到后续等待轮。

### 原生提问分发契约

“提问格式”只定义问题内容，不是普通 assistant 消息的排版模板。任何路径准备等待用户（decision、共识确认、恢复候选、worktree、prototype、finishing 或其他元问题）时，先构造同一个请求：

```yaml
QuestionRequest:
  id: decision-or-meta-id
  question: 一句话问题
  context: 研究背景或 null
  options: [{ id, label, description }]  # 纯开放问题为 []
  recommended: option-id | null
  free_form: true | false
```

然后按以下顺序分发：

1. 从当前宿主已暴露的工具中识别结构化用户输入能力，例如 `AskUserQuestion`、`request_user_input`、`ask` 或等价工具；能力结论在本会话内复用。
2. 工具能忠实表达当前 `QuestionRequest` 时，分发动作固定为“选择已暴露工具 → 按其真实 schema 填参 → 产生宿主可识别的 tool call event → 结束本轮等待”。**必须真实调用该工具**，一次调用只发当前一个问题；在普通 assistant 文本中写工具名、JSON、伪调用或编号菜单都不算调用，也不得与真实调用重复发送。
3. `options` 映射到原生选项及说明，`recommended` 映射到原生推荐字段；宿主没有推荐字段时，把推荐项移到第一项并在 label/description 标注。宿主自动提供 `Other` / 自定义输入时不得再造“其他”选项，直接把它作为 `free_form` 出口。
4. 纯开放问题优先使用支持自由文本的原生工具；只有宿主没有结构化提问工具，或工具 schema 无法在不伪造选项的前提下表达当前问题时，才退化为文字提问。首次退化时用一句话说明 `no-native-question-tool` 或 `unsupported-question-shape`，禁止静默降级。

Stage 可以构造 `QuestionRequest`，但实际等待前由当前编排 frame 完成上述分发，并记录 `Delivery: native:<tool> | text-fallback:<reason>`。


### 提问格式

向用户提出的决策问题统一使用引导式格式，不裸问：

1. **问题**：一句话说清要定什么、为什么现在定。
2. **背景**（有研究时）：1-3 行同类产品做法、项目现状或研究发现；来源优先级为同类设计 > 官方指南/最佳实践 > 模型自身判断，无同类时标注"无直接同类，以下是我的理解"。
3. **选项**：2-4 个，每个附一句差异或代价；明确标注**推荐项和理由**，但不替用户选择。
4. **自由输入出口**：明确告知可以不选任何选项、直接描述想法或大方向。

问用户独有信息（业务规则、偏好、资源约束）时用开放问题，可附示例降低回答负担，不硬造选项；是否使用原生工具只由上节分发契约决定。

格式随用户对当前领域的熟悉度伸缩：Assisted 转入的卡点或用户自述不懂时用完整引导式（背景 + 选项 + 推荐），降低决策门槛；用户主导且熟悉的 Owner 领域内，开放问题 + 推荐即可，选项只在方案空间确实存在多个候选时列出，不为格式而造选项。两条路径的差异始终由 owner 分权决定（问多少、谁决定什么）；本格式只统一"怎么问"，不改变分权。

用户的自由输入是一等回答：给出明确决定 -> 按答案关闭 node；给出想法、方向或部分意见 -> 进入**收敛循环**——复述理解、必要时补充研究、更新选项和推荐后继续一次一问，直到该 node 收敛为明确决定。收敛循环是用户驱动的深入，不受"仪式性追问限一次"约束；由此产生的新问题按规则生成新 node。

## 第 1 级 - 按当前决策分权

路由单位是 decision node，不是用户身份。

| 模式 | 触发信号 | 节点 owner | Stage |
|---|---|---|---|
| Assisted | “我不懂 / 你先设计 / 你推荐” | 默认 `model`；重大卡点转 `user` | `design-assist` |
| Owner | “这部分我来定 / 逐项问我 / grill me” | 选定领域内所有真实决策为 `user` | `grilling` |
| Mixed | 不同领域采用不同控制权 | 写入 `owners` map | 按全局 frontier 逐节点选择 |

只声明部分领域时，未声明领域默认 `owner: model`；无领域限定的 Owner 信号（"逐项问我"、"grill me"、"所有/全部设计都由我定"）视为全领域声明，把全部领域设为 `user`。若用户措辞对某个已 ready node 的 owner 真有冲突，只围绕该 node 问一次，不做全局模式访谈。

提示已经明确时不再问模式问题。只有交互方式确实不清且会改变结果时，构造并按“原生提问分发契约”发出一次：

```yaml
QuestionRequest:
  id: decision-mode
  question: 这部分由你逐项决定，还是由我先调研并给出推荐设计？
  options:
    - { id: owner, label: 我逐项决定, description: 真实 decision node 由我回答，Agent 每次只问一个 }
    - { id: assisted, label: Agent 先设计, description: Agent 查明事实并处理明显优解，只把重大权衡交给我 }
  recommended: assisted
  free_form: true
```

更新等待状态后真实调用宿主工具；不得把以上问题或选项改写成普通 assistant blockquote。

### Assisted 的用户卡点

以下节点必须转为 `owner: user`：

- 多个合理方案存在不可消除的长期重大权衡。
- 影响存量数据、公开接口、兼容性或不可逆迁移。
- 涉及安全、合规、隐私、资金或数据完整性边界。
- 涉及预算、团队能力、期限等工具无法得知的资源约束。
- 用户明确保留所有权。

项目事实、既定技术栈、命名、目录和明显优解由模型处理。

### Owner 的严格边界

Owner/grill-me 领域内只能跳过：

- 可由代码、配置、环境、文档或外部资料查明的事实。
- 已在 `decisions` 中确认的结论。

其余 decision node 无论大小都要一次一问并附推荐。若用户说“这部分你看着办”，先把对应节点显式改为 `owner: model` 并记录 ownership change；不能静默替用户决定。

## 第 1.5 级 - UI 独立分流

业务 owner 不能推导 UI mode。只在真实涉及视觉、布局或交互时设置：

| UI mode | 行为 |
|---|---|
| Prototype-Assisted | UI 节点需要视觉证据时进入 prototype；owner 不因此改变 |
| Design-Owner | UI node 以讨论优先；既有 owner 决定由 grilling 还是 design-assist 处理 |
| Direct | 遵循既有设计稿/设计系统，UI 节点由模型直接解决 |
| Text-Only | 只用文字、表格或简单线框，不进入 prototype |

按用户的明确信号确定 UI mode；同一请求命中冲突信号且差异会改变工作量时才问一次：

1. 已有明确终稿/设计系统且要求照稿实现 -> `Direct`。
2. 明确“不要原型” -> `Text-Only`。
3. 明确“先给我看原型/多版视觉方案” -> `Prototype-Assisted`。
4. 用户保留 UI/design owner 并要求逐项讨论，但没有要求原型 -> `Design-Owner`。
5. Assisted 用户无法靠文字判断真实视觉问题且未表达偏好 -> `Prototype-Assisted`。

这些规则只定 UI mode，不改变 node owner；例如 `Text-Only + owner:user` 仍由 grilling 用文字逐项询问。

应用上述优先级后 UI mode 仍无法确定，且不同 mode 会实质改变结果或成本时才问一次。视觉-only 请求在结论吸收且全局节点关闭后可以 `stop`，不强迫实现。

## 全局 Mixed 调度

1. 编排器从整个 `open_nodes` 中选择一个 dependency-ready 节点。
2. `owner: model` 读取 `design-assist`；`owner: user` 读取 `grilling`。
3. 任一 user-owned 分支活跃时，全工作流每轮最多向用户提出一个决策问题；不能同时追加其他领域的问题批次。
4. stage 只返回当前节点 delta。编排器合并后再选择下一个节点，不允许 design-assist 与 grilling 互相直接 handoff。
5. 局部领域完成不产生全局 plan/execute readiness。必须等全部领域的 `open_nodes` 和 `fog` 关闭。

## Fog 发现循环

`fog` 用于路径还看不清、无法直接形成完整决策树的工作：

1. 先按当前 owner 规则确定 destination：最终要得到 spec、关键决定还是实际改动；用户连 destination 都说不清时，先用开放问题逐轮收敛出 destination，再开始映射。
2. breadth-first 扫描产品、架构、数据、安全、UI、资源和验证面；能准确表述的写成稳定 id 的 `open_nodes`，暂时说不清的写入 `fog`。
3. `fog` 非空即满足机械落盘条件；在第一次等待用户前创建 `DESIGN.md`。
4. 按全局 frontier 解决节点：事实研究走 model，价值决策走 user，纸上无法判断的单个节点走 prototype。
5. 每个结果都更新 decisions、pruned/rejected branches、open_nodes 和 fog；新问题只有在可准确表述时才升级为 node。
6. 同时满足以下条件才退出 discovery：destination/成功标准明确；scope/non-goals/约束明确；`fog` 为空；所有设计节点关闭；验证目标已知。
7. 若 breadth-first 扫描证明任务实际很小，直接转普通 design/Transient，不创建长期地图；已创建的 DESIGN.md 按用户意愿删除或保留，不遗留无主 checkpoint。

发现循环只产生决定，不提前生产实现。

## Prototype detour

进入 prototype 时读取 `stages/prototype/STAGE.md`，并传入完整 WorkflowState、`ParentDecisionId`、Question 和 Success signal。返回字段契约以该 stage 文档为准，本文件不复制 schema。

编排器把返回 delta 合并回 parent node，保留其他领域 state：`pending` 继续等待同一视觉决定；`answered` 只表示证据已形成——parent 为 `owner: model` 时可据此关闭，为 `owner: user` 时必须保留为 ready，直到用户明确确认；`blocked` 表示问题本身不清，先澄清 Question/SuccessSignal 再重新进入。只有全局请求本来就是 visual-only 且没有其他 open node 时，编排器才设置 `Readiness: stop`。

## 共识与 Readiness 硬门

只要存在 user-owned decision，所有节点关闭后必须复述完整决策链并把 `consensus` 设为 `pending`：grilling 处于活跃时由它执行 recap；最后一个节点由 design-assist 或 prototype 关闭、无 stage 在场时，由编排器自行执行 recap。只有用户明确确认后才能改为 `confirmed`。

`consensus: confirmed` 后只要新增/重开 `open_node` 或 `fog`，立即失效：本 effort 仍有任何 `owner:user` decision 时重置为 `pending`，否则重置为 `not-required`。重新通过 recap 前不得 planning/execute。

编排器按以下顺序计算 readiness：

1. `open_nodes` 非空、`fog` 非空，或本轮存在 user-owned decisions 且 `consensus != confirmed` -> `continue-design`。
2. 目标只要求研究/评审/设计，且交付已满足 -> `stop`。
3. 单会话低风险实现 -> `transient-execution`。
4. 需要恢复、高风险或依赖较多 -> `durable-plan`。
5. 多 deliverable 或依赖链 -> `epic-plan`。

任何内部 stage 都不能绕过此门。Assisted 产生了未回答用户卡点时同样保持 `continue-design`。

## Stage 导航表

按需只读一个 stage。条件列是 WorkflowState 谓词，命中即读、一跳完成路由：

| State 谓词 | Supporting stage |
|---|---|
| `phase ∈ {design, discovery}` ∧ `current_node.owner = model` | `stages/design-assist/STAGE.md` |
| `phase ∈ {design, discovery}` ∧ `current_node.owner = user` | `stages/grilling/STAGE.md` |
| 编排器接受 PrototypeRequest，`prototype.parent_id` 已写入 | `stages/prototype/STAGE.md` |
| `phase = plan` ∧ `readiness ∈ {durable-plan, epic-plan}` | `stages/writing-plans/STAGE.md` |
| `phase = execute`（Transient 直入；Durable/Epic 需 plan-ready） | `stages/executing-plans/STAGE.md` |
| `phase = execute` ∧ 当前 task 是永久生产功能/bugfix/refactor/行为变化，写实现代码前 | `stages/test-driven-development/STAGE.md` |
| `phase = debug`（bug、测试/构建失败、异常；detour 先写 return_point） | `../zhanggui-systematic-debugging/SKILL.md`（Zhanggui Embedded） |
| `phase = verify`（任何完成或修复声称前；detour 先写 return_point） | `stages/verification-before-completion/STAGE.md` |
| 完成门/任务级/ad-hoc 评审触发（同步子步骤，不占 return_point 单槽） | `stages/code-review/STAGE.md` |
| verification `verified` ∧（工作在独立分支/worktree ∨ 用户要求收尾） | `stages/finishing-a-development-branch/STAGE.md` |
| `phase = execute` 开始前 ∧ 隔离触发（高风险/并行写范围/脏工作区/用户要求） | `stages/using-git-worktrees/STAGE.md` |
| 存在互不相关的可并行问题域 ∧ 宿主有 subagent 能力 | `stages/dispatching-parallel-agents/STAGE.md` |

Transient 直接进入 execution stage；Durable/Epic 先进入 planning stage。执行 stage 对永久生产功能和 bugfix 必须在写实现前加载 TDD stage；throwaway prototype 不加载。

### Design drift 唯一路径

execution 返回 `design-drift` 时，确认 `return_point` 为空后写入 `{ phase: execute, node: <task-id>, evidence_ref: <finding> }`，把受影响决定重新建为 open node，并按共识失效规则重置 consensus 后进入 design/discovery。design-drift 是 detour：活跃性由非空 `return_point` 表示；drift 重设计期间 `awaiting` 按设计阶段正常取值，不新增枚举值。设计再次通过全局 readiness 后，Transient 重算会话 plan；Durable/Epic 重新进入 planning 更新 SPEC/EPIC、任务边界、依赖和 validation，之后才恢复原 task。只需更新事实文字而不改变决定时属于 fact drift，不走此分支。

### Verification dispatch

进入 verification 前，调用方必须把自己的 phase/node 和证据写入 `return_point`。`verified` 允许对应 claim/stop；`not-verified` 按 return point 恢复，不能成为死端。

## 完成与退出

- 每次等待、stage delta 和恢复都更新同一 WorkflowState。
- 用户暂停时先写必要的 DESIGN/PROGRESS checkpoint，再退出。
- 只有工具和仓库都无法提供、且会实质改变结果的信息才升级给用户。
- 完成声称前必须读取 verification stage 并运行能证明目标的最新检查。
- 用户明确放弃当前目标或方向大变时执行 scope reset：剪枝全部 `open_nodes` 和 `fog`，作废受影响的 decisions（不受影响的保留），按共识失效规则重置 `consensus`，再从新目标重新路由；已落盘的 DESIGN.md 按用户意愿删除或保留，不遗留无主 checkpoint。
- 用户明确暂停、终止或切换其他工作时，先保存当前 checkpoint，再停止本编排 frame。
