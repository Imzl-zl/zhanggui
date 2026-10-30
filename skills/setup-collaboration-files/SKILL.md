---
name: setup-collaboration-files
license: MIT
description: Initializes or normalizes a project's collaboration file system — rule files such as AGENTS.md and CLAUDE.md, architecture docs, decision notes, and status files. Use when the initialization or normalization itself has to be carried through, such as when the user asks to "init project", "set up AGENTS.md", "initialize collaboration files" or "normalize rules", or when work starts on an unfamiliar project that lacks structured collaboration files, whether greenfield or with existing rule files to unify.
---

# Init Project - 项目协作体系初始化

## 使用方式

- 直接调用 `setup-collaboration-files` skill
- 不需要参数
- 内部只处理两种情况：项目里还没有规则文件 / 项目里已经有规则文件

## 目标

在项目根建立或归一这套协作体系。它由三根支柱和两张辅助表组成，**每个事实只有一个家**：

| 产物 | 职责 | 真值地位 |
|---|---|---|
| `AGENTS.md` | 全仓常驻短军规；一条 1–3 行 + 链接 | 协作规则真值源 |
| `<子目录>/AGENTS.md` | 模块就近规则，有强信号才生成 | 该作用域内的约束 |
| `CLAUDE.md` | 兼容入口；内容恒为 `@AGENTS.md`，不存在则创建 | 无 |
| `docs/` | 当下系统怎么运转 | 现状真理源 |
| `docs/postmortem/` | 真实踩过的雷与线上事故 | 唯一允许写血泪史的地方 |
| `docs/AGENTS.md` | 文档标准：字数预算、去废话、禁手抄生成物 | 文档规则 |
| `.agents/notes/` | 当初为什么这样、放弃过什么 | 因果真理源 |
| `.agents/notes/AGENTS.md` | 笔记的仓库不变量 | 笔记规则 |
| `tools.md` | 稳定可复用的命令、路径、模式、坑点 | 辅助 |
| `memory.md` | 当前状态快照 + 最近活跃窗口 | 辅助 |

## 三支柱的边界

- 根 `AGENTS.md` 管「开工前必须知道什么」。每次新会话开工先读，一条 1–3 行，讲完给链接，绝不堆长文和背景故事。
- `docs/` 管「现在是什么样」。只写当下事实，严禁「以前 / 现在 / 不再 / 改名为」这类变迁叙述——历史归 git 和笔记，带着历史包袱的手册会迅速发霉。
- `.agents/notes/` 管「当初为什么这样」。只写已经发生的取舍，不写安装教程、使用手册和接口现状——版本一跳就过期。
- `docs/postmortem/` 是全仓唯一允许写血泪史的地方。故障解决后沉淀成规矩，再提炼成**一行**进根 `AGENTS.md`。
- 同一件事只准有一个家：现状事实进 `docs/`，因果进 notes，命令速查进 `tools.md`，当前状态进 `memory.md`。写串了，两边就都找不到想要的。

## AGENTS.md 的生成策略

根 `AGENTS.md` 由「常驻军规 + 最小骨架 + 按仓库信号追加的独立小节」组成：

- **常驻军规**（最前，3–6 条）：每条一行、可机械判定、附链接。这是 agent 每次真正会读的部分，价值最高。
- **最小骨架**：`0. 实施基线` / `1. 作用` / `2. Source of Truth` / `3. 架构与项目结构` / `4. 协作文件与决策笔记规则` / `5. 验证、入口与关键路径` / `6. 项目特定规则` / `7. 维护原则`。
- **条件独立小节**：仓库已有强信号时才拆，例如 `架构基线`、`模块规则`、`分层依赖规则`、`shared/core 规则`、`workflow 特别规则`、`文档同步规则`、`禁止事项`。没有信号就不要造。

字数预算（缺省值；仓库已有自己的预算文件或 CI 阈值时以仓库为准）：根 `AGENTS.md` ≤1,950 词，子目录 `AGENTS.md` ≤750 词，`docs/architecture.md` ≤2,400 词。超限时的处理顺序是**先下沉到 `docs/`，再精简文字**，不允许靠删约束来达标。

模块规则不往根上堆。某个包、某个子系统的运行时断言、类型约定、目录禁忌，就近写进那个目录的 `AGENTS.md`，根上只在结构导航里留一行说明。

## 与 decision-notes 的分工

两个技能是**同一套体系的两半**，靠一条单向依赖相连：

- `setup-collaboration-files`（本技能）**铺设骨架并写仓库不变量**：建目录、写根 `AGENTS.md` 的笔记军规、生成 `.agents/notes/AGENTS.md`。它不写任何具体笔记。
- `decision-notes` **执行**这套规则：单篇笔记的非平凡判定、四格写法、状态迁移与取代流程都在那里。

因此：

- 本技能**不得复述**四格模板和非平凡判定表。`templates.md` 里的 `.agents/notes/AGENTS.md` 只写"什么不许做"，写作方法一律留给 `decision-notes`。
- 两边引用笔记体系时，只引 `.agents/notes/AGENTS.md` 这个仓库运行时契约，不复述它的内容。
- 骨架铺完而之后没人写笔记，等于没铺。所以根 `AGENTS.md` 里那条军规必须**指名 `decision-notes` 技能**。

## Workflow

### Step 1: Locate Project Root

优先执行：

```bash
git rev-parse --show-toplevel 2>/dev/null
```

- 成功：结果记为 `repo_root`
- 失败：提示当前目录不是 git 仓库，并询问是否把当前目录作为项目根继续
- 项目名使用 `basename "<repo_root>"`

### Step 2: Read Current Context

#### 2a. Read existing collaboration and rule files

存在则读，不存在跳过：

- `<repo_root>/AGENTS.md`、`CLAUDE.md`、`tools.md`、`memory.md`
- `<repo_root>/docs/AGENTS.md`、`.agents/notes/AGENTS.md`
- `<repo_root>/README.md`、`docs/README.md`、`docs/architecture.md`
- 明显的子目录规则文件：`<子目录>/AGENTS.md`
- 旧的 `memory/archive/[当月 YYYY-MM].md`（只读当月或最近一个归档，用于判断是否要迁移）

正式文档的发现规则、候选目录和命名模式见 `references/scan-signals.md`。原则是：**只读能帮助判断真值源、结构边界、目录职责、验证方式的少量高信号文档**，不要为了"看起来全面"批量扫完整个 `docs/`。

#### 2b. Scan repository structure and engineering signals

按 `references/scan-signals.md` 的清单探测：顶层目录、各生态 manifest 与构建文件、CI 配置、关键入口、分层方向、共享目录，以及已存在的 `docs/` 布局、`.agents/notes/` 状态目录、子目录 `AGENTS.md`。

**标准验证命令抽取规则**（这条最容易出错，单独强调）：

- 只能从仓库内**显式存在**的信号提取：manifest 已声明的 script/task、`Makefile`/`Taskfile*`/`Justfile` 的真实 target、CI 里的真实校验命令、README/docs/现有规则文件里明确写出的命令。
- 优先保留仓库里已有的原始写法，不擅自改写成"更常见"的风格。
- 仓库里没有明确验证命令时只能写 `[待补充]`，不能因为看到某个生态文件就猜成 `npm test`、`pnpm lint`、`pytest`、`cargo test`。
- `tools.md` 的定向验证命令同样只允许来自显式信号。

#### 2c. Classify existing rule files

对每一个既有文件（`AGENTS.md`、`CLAUDE.md`、子目录 `AGENTS.md`、`docs/AGENTS.md`、`.agents/notes/AGENTS.md`、`tools.md`、`memory.md`）做二分类：

- **substantive**：包含真实规则、结构约束、命令、协作规则、模块边界等内容
- **non-substantive**：不存在，或只是指针、空壳、占位、薄内容文件

关键只有两点：有没有可用的 substantive 规则文件、有没有现有文件需要先备份。

#### 2d. Git history for memory initialization

如果仓库已有提交历史，且 `memory.md` 缺失或只是空壳，则读最近 **8** 条提交来初始化记忆：

```bash
git log -n 8 --date=short --pretty=format:'%ad%x09%s'
```

标题过于笼统时，再补看同样 8 条提交涉及的文件：

```bash
git log -n 8 --date=short --name-only --pretty=format:'COMMIT %h %ad %s'
```

为什么是 8：少于 5 条通常看不出近期方向，多于 10 条噪音明显上升，8 条覆盖大多数项目最近 2~3 个工作窗口。

git 历史**只**用于初始化 `memory.md`，不当正式真值源，也不用来伪造 archive 历史。

#### 2e. Determine branch

- **情况 A：没有 substantive 规则文件** → 全新初始化模式。都不存在就直接按模板创建；任一存在但 non-substantive 就先备份再创建。
- **情况 B：已有 substantive 规则文件** → 归一优化模式。不再询问，直接进入：先备份，再按当前标准生成新的 canonical `AGENTS.md`；已有 `CLAUDE.md` 改写为 `@AGENTS.md`。

### Step 3: Apply Normalization Principles

读 `references/rules.md`，按其中的硬规则和归一原则执行。

生成公式：

```text
AGENTS.md = 常驻军规 + 固定协作骨架 + 当前仓库事实 + 用户已有有效规则
```

信息优先级（按类别，不是一条全局优先级）：

1. **协作记忆体系规则** — 以固定骨架为准；仓库已有写法更强且不冲突时可继承
2. **结构、技术栈、目录职责、入口、验证命令** — 以当前仓库事实和正式文档为准，不能被陈旧规则覆盖
3. **项目特定约束** — 优先继承已有 substantive 规则，再用正式文档和当前代码校验补强；仓库里没有就不要发明
4. **近期活动线索** — 只用于 `memory.md`，不进入 `AGENTS.md` 的正式规则区

### Step 4: Generate or Enhance `AGENTS.md`

骨架与各节要求见 `references/templates.md`。

必须覆盖：

- **常驻军规**：3–6 条，每条一行。必须包含「非平凡改动，代码与决策笔记同批提交，格式见 `decision-notes` 技能」这一条。
- **`## 0. 实施基线`**：环境、语言/运行时、主要技术栈、配置根目录、标准验证命令。
- **`## 1. 作用`**：本文件是项目级硬规则，只保留长期约束实现结构的内容；详细设计回到 `docs/`。
- **`## 2. Source of Truth`**：正式设计文档优先于本文件；`tools.md` / `memory.md` 只是协作辅助。项目已有明确文档优先级就写成显式清单；没有成熟 `docs/` 体系就退化为"当前代码 / 配置 / README / 本文件"这类最小真实优先级。禁止臆造不存在的路径或层级。
- **`## 3. 架构与项目结构`**：根目录关键职责、核心模块/子应用/包目录、关键分层或边界、可提取时的依赖方向与关键入口。
- **`## 4. 协作文件与决策笔记规则`**：读 `references/templates.md` 的对应段落逐条落实，覆盖 `tools.md` / `memory.md` 的读写时机与 `.agents/notes/` 的不变量，并指名 `decision-notes` 技能。
- **`## 5. 验证、入口与关键路径`**：标准验证命令、关键文档入口、可提取时的定向验证命令与关键入口路径、配置根目录或共享目录。
- **`## 6. 项目特定规则`**：从现有规则/文档/结构提取的架构约束、模块边界、禁止事项、依赖方向。信号强就拆独立小节，信号弱就保持简洁事实化。
- **`## 7. 维护原则`**：保持短、小、硬；近期状态进 `memory.md`，稳定知识进 `tools.md`，现状事实进 `docs/`，因果进 `.agents/notes/`；解释性长文不堆进本文件；标注字数预算。

### Step 5: Generate Compatible `CLAUDE.md`

**始终生成**：不存在就创建，已存在就先备份再改写。理由：并不是每个宿主都会读根 `AGENTS.md`，`CLAUDE.md` 是 Claude Code 的固定入口；省掉它意味着整套规则在那些宿主上不生效。内容恒为：

```markdown
# [项目名] - 项目指令

@AGENTS.md
```

### Step 6: Normalize `docs/`（条件执行，不强制新建）

- 仓库已有 `docs/` → 归一其结构，并生成/补强 `docs/AGENTS.md`。
- 仓库没有 `docs/`，但散落着 ≥2 篇设计类文档 → 只建 `docs/AGENTS.md` 和一个索引式的 `docs/architecture.md`，**不搬动原文件**；在总结里说明建议后续手工归位。
- 完全没有 → 跳过本节，并在总结里说明。

归一目标结构：

```text
docs/
├── AGENTS.md          # 文档标准与防注水
├── architecture.md    # 骨干预览：模块、边界、扩展点；只做总导航，不写类型细节
├── subsystems/        # 子系统规范：承载真实类型声明与契约
├── cookbook/          # 操作实操：加包、加工具、配环境，每步带编号和验证命令
└── postmortem/        # 事故复盘：真实踩雷记录、排查时间线、止血措施
```

`docs/AGENTS.md` 必须写进四条去废话守则：

1. 只记当下事实，严禁「以前 / 现在 / 不再 / 改名为」这类变迁叙述。
2. 严禁人肉手抄生成物：能由源码或 AST 推导的 API 列表、配置清单必须由代码生成，文档只负责圈定插槽。
3. 文档里的代码块必须能真实编译或运行通过。
4. 字数上限与超限处置：**下沉迁移 → 精简浓缩 → 申请提额**，按此顺序，不允许先删约束。

### Step 7: Generate or Enhance `tools.md`

模板见 `references/templates.md`。

先判断是否 substantive。已有实质内容时先读、保留高质量条目，只补缺失 section 和高信号条目；结构混乱、一次性日志过多、缺关键命令/路径/入口/坑点时先备份再归一重写。

生成原则：

- 只记录长期可复用的协作知识，不写当前单次任务日志。
- `Tools` 只写精确命令、具体路径、明确入口，不写空泛口号。
- `Patterns` 只收仍有效、会重复出现的稳定做法。
- `Pitfalls` 只收可复用的坑点；血泪史本身进 `docs/postmortem/`，这里只留结论。
- 单个 section 信号不足时保留一条 `[待补充：当前仓库暂无足够稳定信号]`，不要堆占位。

### Step 8: Generate or Initialize `memory.md`

模板见 `references/templates.md`。

`memory.md` 是**当前状态快照 + 最近活跃窗口**，允许整体覆盖更新。

- 已存在且有实质内容：保留仍有效内容；结构混乱、窗口过期、失效项过多、超出行数限制时先备份再归一重写。
- 不存在：基于"当前仓库状态 + 最近 8 条 git 提交"初始化。
- 已存在但 non-substantive：备份后按同样来源重建。

初始化约束：

- 只保留 `当前基线` / `已完成能力` / `进行中` / `仍需注意的坑点` / `最近活跃窗口`。**不要**写"关键决策"节——决策的唯一家在 `.agents/notes/`，写在 `memory.md` 就是第二真值源。
- "已完成能力"只写当前仍成立的闭环能力，不搬运 commit 标题。
- "进行中"只写当前文档、规则、工作树或近期提交能明确证明的方向。
- "最近活跃窗口"只保留最近 2~3 天的 3~8 条一句话摘要。
- 不把很久之前的历史硬塞进"最近活跃窗口"。
- 目标 ≤120 行；超出时优先压缩"已完成能力"和"最近活跃窗口"。

### Step 9: Create `.agents/notes/` Scaffold

```bash
mkdir -p "<repo_root>/.agents/notes"/{proposed,implemented,rejected,archived}
```

生成 `<repo_root>/.agents/notes/AGENTS.md`，内容按 `references/templates.md`：**只写仓库不变量**（状态由目录决定、禁止总索引、`implemented/` 随代码更新、`archived/` 永久冻结、码与笔记同批提交、文件名格式）。

不要在这里写四格模板或非平凡判定表——那是 `decision-notes` 技能的职责，重复一份必然会漂移。

如果 `.agents/notes/` 已存在，只补缺失的目录和缺失的不变量条款，不重排既有笔记、不移动文件状态、不重写任何笔记内容。

### Step 10: Handle Legacy `memory/archive/`

如果仓库里已有 `memory/archive/`：

- **保留原文件不动**，不在归一过程中删除任何历史条目。
- 在根 `AGENTS.md` 的协作规则里写明：该目录属旧机制，不再追加新条目。
- 在总结里列出建议迁移的条目：仍在生效的**因果**内容迁进 `.agents/notes/<状态>/`，真实事故内容迁进 `docs/postmortem/`，纯流水账交给 git 即可。
- 迁移由用户决定是否执行，本技能不擅自搬迁。

### Step 11: Quality Gate

输出结果前回读生成结果并确认：

- 根 `AGENTS.md` 有常驻军规，且其中一条指名 `decision-notes`；骨架各节不是空话，已写入基线、结构/依赖/入口、协作文件与笔记规则。
- 根 `AGENTS.md` 在字数预算内；没有把模块规则堆到根上。
- `docs/AGENTS.md`（若生成了）四条去废话守则齐全。
- `.agents/notes/AGENTS.md` 只含不变量，**没有**复制四格模板或非平凡判定表。
- `tools.md` 至少有真实命令、路径、模式、坑点中的高信号内容，不是纯占位。
- `memory.md` 没有"关键决策"节；"已完成能力"不是 commit 标题堆砌；"最近活跃窗口"只覆盖最近 2~3 天。
- `CLAUDE.md` 已存在（新建或从已有文件改写而来），且最终内容只剩 `@AGENTS.md`。
- 所有被重写的文件都已备份到 `<repo_root>/setup-collaboration-files.backup/[timestamp]/`。
- 原有 substantive 规则文件的检查（逐类回读，不是抽样）：
  - 根 `AGENTS.md` / `CLAUDE.md`：仍有效的模块边界、真值源规则、项目特定禁令、文档优先级、验证命令已迁移进新文件，而不是静默丢失。
  - 子目录 `AGENTS.md`：仍在有效的模块规则要么保留在原作用域，要么被上提为独立小节，没有静默消失。
  - `tools.md`：仍有效的真实命令、关键路径、稳定模式、可复用坑点已保留或合并。
  - `memory.md`：仍有效的状态、进行中方向、坑点已保留或合并；被移除的确实因为过期或超出定位。
- 失效项的处理方式确认（本次改造的关键一条）：
  - 两类内容处理方式相反。已被正式文档或当前代码证明失效的**旧规则**，不留在 `AGENTS.md` 里当僵尸，也不原样带入；而**已经发生的决定不能删**——`.agents/notes/` 里的条目一律不动，只标注被谁取代后移入 `archived/`。
  - 只有确实无法确认时才写 `[待人工确认]`；默认应主动归并，不要把本可解析的问题留给用户。

### Step 12: Output Summary

至少包含：

- 项目根目录
- 走的是全新初始化还是已有规则归一
- 是否备份、备份路径
- 创建了哪些文件、补强了哪些已有文件
- `docs/` 走的是归一 / 最小索引 / 跳过 中的哪一种
- `.agents/notes/` 骨架是否新建；已存在时补了什么
- `CLAUDE.md` 是新建还是改写
- 旧的 `memory/archive/` 是否存在，以及建议迁移清单
- 从现有规则 / 文档 / git 历史提取到的关键信息
- 仍需人工补充的项
