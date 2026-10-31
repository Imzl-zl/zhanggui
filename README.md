# Zhanggui skills

一个 **skills 创作项目**：产物是 Agent Skills 本身，不是应用代码。仓库根同时是分发单元（Claude Code / Codex 插件），无构建依赖。

三个入口技能，共 11 个 strict Agent Skills 目录：

| 入口 | 内容 | 位置 |
|---|---|---|
| `zhanggui` | selective-hybrid 有状态编排器 + 五个可独立发现的 `zhanggui-*` 工程 leaf | `skills/zhanggui/`、`skills/zhanggui-*/` |
| `setup-collaboration-files` | 项目协作体系初始化 / 归一（AGENTS.md、`docs/`、`.agents/notes/`、tools.md、memory.md） | `skills/setup-collaboration-files/` |
| `decision-notes` | 决策笔记的落盘与生命周期（非平凡判定、四格、状态迁移、取代与冻结） | `skills/decision-notes/` |

其余目录全是辅助设施：`scripts/` 校验与部署、`tests/` 契约断言、`evals/` 触发数据集、`docs/` 设计论证。目录布局遵循 [Agent Skills 规范](https://agentskills.io/specification)：一个技能 = 一个含 `SKILL.md` 的目录，`name` 等于目录名，按需资源分层到 `references/`、`scripts/`、`assets/`。

> 本 README 只是导览，不参与运行，也不复述规则细节——避免出现第三份会漂移的“真值”。运行契约以 [`skills/zhanggui/SKILL.md`](skills/zhanggui/SKILL.md)、各 leaf `SKILL.md`、[`skills/setup-collaboration-files/SKILL.md`](skills/setup-collaboration-files/SKILL.md)、[`skills/decision-notes/SKILL.md`](skills/decision-notes/SKILL.md) 与内部 `STAGE.md` 为准；完整设计论证见 [Skill 融合工作流设计](docs/skill-fusion-design.md)。

集合打包版本 v0.9.0。WorkflowState 与 task-root schema 沿用 v0.4 语义。

description 现已对齐开放规范：规范要求「既描述这个技能做什么，也描述何时用它」，官方作者指南的示例一律是**能力在前、`Use when` 触发子句在后**，并要求「宁可写得多一点」（显式列出用户没直接点名领域也算的场景）。此前八个 description 全部只写触发条件，能力那半个信号完全缺席，已整体改写（触发关键词与前置条件逐字保留）。九个被钉子评测的 description 因此进入**待重测**状态。

评测方法也已换成社区标准的两族：**触发族**用真 agent 观测宿主实际加载了哪个技能（`evals/triggers/`，144 条语料 + 固定 train/validation 划分），**质量族**用 with_skill / without_skill 对照看 delta（`skills/<skill>/evals/`）。运行状态、测量条件与现有数字**只在 [`evals/README.md`](evals/README.md) 维护**，本文不复制。旧判官 harness 降级为廉价的历史描述冲突检查，**不是发布门槛**。

tdd / finishing / dispatching 三处按 v0.8 的确定性误路由做的修订，以及两个 standalone 技能（`setup-collaboration-files`、`decision-notes`，不在路由评测范围内）的情况，见 [`evals/catalog-current.json`](evals/catalog-current.json)。

## 架构要点

- **Eight strict catalog entries**：八个技能均使用 strict Agent Skills frontmatter（`name` / `description` / `license`，根另有 `compatibility`）；`zhanggui` 是唯一有状态根，拥有 `WorkflowState`、return point、readiness 与 Embedded 合并权。
- **选中只靠 description**：宿主启动时只注入 `name` + `description`，规范要求它同时说清「做什么」和「何时用」。所以 description 先写能力、再接 `Use when` 触发子句，不写仲裁条款、不写行为指令、不概述工作流；这条约束由 `tests/skill-discovery.test.mjs` 机械卡住。
- **仲裁与编排在正文**：root-first、narrow-task de-escalation、leaf 边界、`Invocation Modes` 全在正文——那里才会被执行。
- **选择性 Hybrid 根**：高信号复杂请求可自动进入；任何时候也可用宿主原生命令手动进入。
- **内部协议**：`SkillRequest` / `SkillResult` 是 Zhanggui 根拥有的内部协议，不是 Agent Skills 开放标准字段。
- **激活顺序**：native activation → catalog location → controlled collection fallback；业务路由只写 skill name + mode。
- **内部 stage 不加载 sibling**：`design-assist`、`grilling`、`prototype`、`writing-plans`、`executing-plans` 永不加载 sibling skills；返回本地 state/task/node delta，并在需要 leaf 时返回 `SkillRequest` 供根消费。
- **验证命令**：trigger eval 与 clean-host acceptance 见下方命令；完整 collection 仍是唯一安装单元。

## 快速使用

复杂请求可以直接描述；支持 model-selected skills 的宿主会按 `zhanggui` 的 description 选择性自动加载它，根在首次工具调用前说明进入原因。触发面以该 description 为唯一出处，本文不复述——根只对"一次做不完"的请求负责，实现与交付细节归对应 leaf。调试、TDD、验证、审查、反馈、worktree、并行派发和分支收尾等窄请求仍由对应 leaf 自动匹配。

需要确定性进入完整流程时，只显式调用一次根：

- **OMP 交互式**：`/skill:zhanggui`
- **提供同名 alias 的宿主**：`/zhanggui`

阶段切换和 Embedded leaf handoff 不要求继续输入命令。

入口在同一编排 frame 内完成：

```text
意图判断
  -> 建立可恢复 WorkflowState
  -> 按 decision node owner 调度设计
  -> 必要时做 UI/逻辑 prototype
  -> Transient / Durable / Epic
  -> TDD、执行、调试
  -> 新鲜验证
```

调试、TDD、完成验证、请求/接收审查、worktree、并行派发或分支收尾等窄任务也可单独描述，由宿主发现对应 leaf skill；Direct 模式不会虚构掌柜的 WorkflowState。完整工作流中，同一 leaf 由根通过 `SkillRequest` 按 `Zhanggui Embedded` 契约激活并合并 `SkillResult`。

## 仓库结构

```text
zhanggui/                             # 仓库根 = 创作项目 = 插件 = marketplace
├── .claude-plugin/
│   ├── marketplace.json          # 列出本仓库自身（source: "./"）
│   └── plugin.json               # Claude Code manifest; skills -> ./skills/
├── .codex-plugin/plugin.json     # Codex manifest; skills -> ./skills/
├── .agents/skills/               # vendored 开发工具技能（writing-skills），不参与交付
├── package.json                  # npm scripts + pi package skills entry
├── AGENTS.md / CLAUDE.md         # 本仓库开发规则（CLAUDE.md 只指向 AGENTS.md）
├── LICENSE / README.md
├── docs/                         # design rationale, not loaded at runtime
│   └── history/                   # 已完成变更的计划/设计快照，只作追溯
├── evals/
│   ├── README.md                 # 两族方法论、运行方式与成本
│   ├── triggers/                 # 族 1 语料：全域触发用例 + 固定 train/validation 划分
│   ├── results/                  # 运行记录（旧判官 summary 只读）
│   └── catalog-current.json      # 当前 description 目录的 digest 门
├── scripts/
│   ├── validate-agent-skills.mjs # strict Agent Skills validation（自动发现 skills/）
│   ├── run-trigger-eval.mjs      # 族 1 runner：真 agent 观测激活
│   ├── run-quality-eval.mjs      # 族 2 runner：with/without 对照看 delta
│   └── deploy-skills.sh          # mirror skills/ into a host skills dir
├── tests/                        # discovery / routing / trigger contracts
└── skills/                       # the only source of truth
    ├── setup-collaboration-files/             # standalone bootstrap skill
    │   ├── SKILL.md
    │   └── references/{rules,templates,scan-signals}.md
    ├── decision-notes/           # standalone note lifecycle skill
    │   ├── SKILL.md
    │   └── references/{notes-contract,note-template}.md
    ├── zhanggui/                 # selective-hybrid strict orchestrator
    │   ├── SKILL.md
    │   ├── RECOVERY.md
    │   ├── agents/openai.yaml
    │   └── stages/               # shared-state steps, undiscoverable
    │       ├── design-assist/STAGE.md
    │       ├── grilling/STAGE.md
    │       ├── prototype/{STAGE,UI,LOGIC}.md
    │       ├── writing-plans/STAGE.md
    │       │   └── references/plan-document-reviewer-prompt.md
    │       └── executing-plans/STAGE.md
    ├── zhanggui-systematic-debugging/
    │   ├── SKILL.md
    │   ├── references/           # root-cause tracing, defense in depth, waiting
    │   ├── scripts/find-polluter.sh
    │   └── evals/                # 族 2 语料 + buggy-cart 夹具（故意 1 个测试失败）
    ├── zhanggui-test-driven-development/
    │   ├── SKILL.md
    │   ├── references/testing-anti-patterns.md
    │   └── evals/                # 族 2 语料 + fresh-cart 夹具（全绿）
    │   ├── SKILL.md
    │   └── references/code-reviewer.md
    ├── zhanggui-using-git-worktrees/SKILL.md
    ├── zhanggui-dispatching-parallel-agents/SKILL.md
    └── zhanggui-finishing-a-development-branch/SKILL.md
```

`skills/` 是唯一真值源。宿主 skills 目录（`~/.claude/skills/`、`~/.agents/skills/`、`~/.codex/skills/`）与仓库内 `.pi/` 快照一律视为生成产物，只能由安装或 `scripts/deploy-skills.sh` 写入，不在那里改规则。仓库内 `.claude/`、`.codex/` 快照已删除：它们只是为了让人直观看到该放哪儿，而本节的安装命令已经表达同一件事，留实体副本只会制造第二个真值源。

各宿主读哪个目录（**实测**，不是推测）：`~/.agents/skills/` 是 Codex / Copilot / Gemini / pi 认的跨运行时别名，**Claude Code 不读它**；Claude Code 只认 `~/.claude/skills/` 或插件安装。所以共享部署放 `.agents`，Claude Code 单独走插件或 `--target claude`。Bundled resource 按 Agent Skills 惯例分层：`references/` 放按需加载的文档，`scripts/` 放可执行脚本。

开发本仓库用的第三方技能放 `.agents/skills/`，与交付物隔离（plugin manifest、validator、deploy 都只看 `skills/`）。目前只装了 [`writing-skills`](.agents/skills/README.md)——superpowers 的技能创作方法论，新建或大改技能前先读它。

### 安装单元：完整 collection

完整可移植单元是 `skills/` 下的全部目录（`zhanggui/` + 八个 `zhanggui-*/` + `setup-collaboration-files/` + `decision-notes/`），无需构建。按宿主能力优先选择正式安装方式：

**1. Claude Code 插件（首选）**

仓库根同时带 `.claude-plugin/marketplace.json` 和 `.claude-plugin/plugin.json`，可直接作为 marketplace 安装：

```text
/plugin marketplace add Imzl-zl/zhanggui      # 或本地路径
/plugin install zhanggui@zhanggui-marketplace
```

插件安装由宿主管理版本与更新，不产生手工副本。

**2. Codex 插件**

宿主加载仓库根 `.codex-plugin/plugin.json`（skills root 指向 `./skills/`），`skills/zhanggui/agents/openai.yaml` 声明 `allow_implicit_invocation: true`。

**3. 裸 collection（宿主不支持插件时）**

```bash
./scripts/deploy-skills.sh --target claude     # ~/.claude/skills
./scripts/deploy-skills.sh --target codex      # ~/.codex/skills
./scripts/deploy-skills.sh --target agents     # ~/.agents/skills
./scripts/deploy-skills.sh --target DIR --dry-run
```

脚本从 `skills/` 单向镜像每个技能目录并删除目标里已不存在的文件，因此过期副本不会变成第二真值源；它不触碰目标目录内其他来源的技能。

也可以直接手工复制——插件不是必需的：

```bash
cp -R skills/zhanggui skills/zhanggui-* skills/setup-collaboration-files skills/decision-notes ~/.agents/skills/
```

手工复制和脚本的唯一区别是脚本会清掉目标里源已删除的残留文件。改名或删除文件后用手工复制会留下过期副本，所以重复部署优先用脚本。

只复制 `skills/zhanggui/` 会缺少 Embedded leaf 依赖，不是完整安装；`setup-collaboration-files` 和 `decision-notes` 都可单独复制，它们不依赖 Zhanggui，但两个一起装才完整——一个铺骨架，一个写笔记。Agent Skills 仍是渐进加载：启动只注入每个技能的 frontmatter；实际匹配后才加载对应 `SKILL.md`。根编排器通过 Skill Activation Contract 激活 leaf，而不是把 sibling 路径当作业务接口。不要同时启用插件与裸 collection，也不要同时启用另一套默认强编排入口。

### 宿主调用模型

- 八个技能的 `name` + `description` 全部 catalog-visible，均可被宿主按 description 自动匹配或用宿主原生命令手动调用；description 里没有任何互斥仲裁，`setup-collaboration-files` 与 `decision-notes` 不参与根/leaf 路由。
- `skills/zhanggui/SKILL.md` 是唯一默认强编排入口，采用选择性 Hybrid：高信号完整生命周期请求可自动进入，也可显式调用；Codex profile 设置 `allow_implicit_invocation: true`。
- 五个 `zhanggui-*` leaf 都有独立 `SKILL.md` 和「能力 + `Use when ...`」description；每个 leaf 都定义 `Direct` 与 `Zhanggui Embedded` 两种契约。
- 确定性进入完整工作流时只显式调用一次根编排器（OMP 交互式为 `/skill:zhanggui`；逻辑 alias 为 `/zhanggui`）；阶段切换不要求继续输入命令。
- Embedded 路径只接受根提供的 `SkillRequest`，leaf/stage 返回 `SkillResult` 或请求；根按 native activation → catalog location → collection fallback 激活，并校验 frontmatter 身份后合并 delta。
- `design-assist`、`grilling`、`prototype`、`writing-plans`、`executing-plans` 保持内部 `STAGE.md`，永不加载 sibling skills；返回本地 state/task/node delta，并在需要 leaf 时返回 `SkillRequest` 供根消费；`RECOVERY.md` 也不参与 discovery。

## 协作文件体系（setup-collaboration-files + decision-notes）

两个独立入口技能，与 Zhanggui 完全解耦，不共用 `WorkflowState`。它们是**同一套体系的两半**，靠一条单向依赖相连：`setup-collaboration-files` 铺骨架并写仓库不变量，`decision-notes` 执行写作与生命周期，任一方都不复述另一方的规则（由 `tests/collaboration-contract.test.mjs` 机械卡住）。

| 技能 | 时机 | 职责 |
|---|---|---|
| `setup-collaboration-files` | 一次性接入或归一 | 建目录、写根 `AGENTS.md` 军规、生成 `.agents/notes/AGENTS.md` 与 `docs/AGENTS.md` |
| `decision-notes` | 每次非平凡改动 | 非平凡判定、四格写法、状态迁移、取代与冻结 |

`setup-collaboration-files` 的产物：

| 产物 | 用途 |
|---|---|
| `AGENTS.md` / `CLAUDE.md` | 全仓 canonical 规则文件；`CLAUDE.md` 仅为 `@AGENTS.md` 兼容入口 |
| `<子目录>/AGENTS.md` | 模块就近规则，不往根上堆 |
| `docs/` + `docs/AGENTS.md` | 现状真理源与文档标准（字数预算、去废话、禁手抄生成物） |
| `.agents/notes/` + `.agents/notes/AGENTS.md` | 因果真理源与其仓库不变量 |
| `tools.md` | 稳定协作知识、常用命令、模式、坑点 |
| `memory.md` | 当前状态快照 + 最近活跃窗口（不含决策条目） |

旧的 `memory/archive/YYYY-MM.md` 月度流水已退役：已有文件保留不动、不再追加，仍在生效的条目建议迁入 `.agents/notes/` 或 `docs/postmortem/`。

描述“初始化项目协作文件”或“写决策笔记 / 记录为什么这么选”类请求即可自动匹配对应技能；Claude Code 安装插件后也可用 `/setup-collaboration-files`、`/decision-notes` 薄壳命令进入。全新初始化与已有规则归一两种模式由技能内部自动识别，重写前自动备份；规则与模板原文只在 [`skills/setup-collaboration-files/`](skills/setup-collaboration-files/SKILL.md) 与 [`skills/decision-notes/`](skills/decision-notes/SKILL.md)。

## 核心概念地图

规则原文只在右列出处维护（内部 `stages/...`、`references/...` 相对 `skills/zhanggui/`；leaf 位于 `skills/zhanggui-*/`），此表只是索引：

| 概念 | 一句话 | 规则出处 |
|---|---|---|
| WorkflowState | 全会话唯一状态对象；简单任务只用最小投影 | SKILL.md「WorkflowState」 |
| SkillRequest/Result | 根拥有的 Embedded 激活/合并协议 | SKILL.md「Skill Activation Contract」 |
| 意图路由 | 恢复/问答/bug/计划/局部改动/想法/fog 的入口分流 | SKILL.md「第 0 级」 |
| Decision owner | 以决策节点为单位分权：Assisted / Owner / Mixed | SKILL.md「第 1 级」 |
| 提问契约 | `QuestionRequest`、引导式格式、原生结构化通道与降级、一次一问的节奏 | `references/questioning.md` |
| UI mode | Prototype-Assisted / Design-Owner / Direct / Text-Only，与业务 owner 正交 | SKILL.md「第 1.5 级」 |
| Prototype | 用可运行证据回答一个决策节点，delta 合并回 parent | `stages/prototype/` |
| Fog discovery | 大而模糊工作的发现循环，只产生决定不产生实现 | SKILL.md「Fog 发现循环」 |
| 共识与 readiness | user-owned 决策必须 recap 确认；五级 readiness 硬门 | SKILL.md「共识与 Readiness 硬门」 |
| Shape 与真值 | Transient 会话 plan / Durable TODO.csv / Epic 父子 CSV，单一真值 | `stages/writing-plans/`、`stages/executing-plans/` |
| 恢复 | 压缩 state 块 + 机械触发的 DESIGN checkpoint + 冷启动流程 | SKILL.md「跨会话设计检查点」、`RECOVERY.md` |
| 质量与收尾 | 审查双轴、分支收尾、worktree 隔离、并行派发——既可独立使用，也可嵌入根 frame | 对应 `skills/zhanggui-*/SKILL.md` |

与模型内置 plan 的关系：模型 plan 保持短（目标与即时进度），磁盘 tracker 只补执行细节（boundary、related_files、sync_targets、depends_on、validation），会话 plan 是磁盘 CSV 的镜像投影。细节见 `stages/writing-plans/STAGE.md`「与模型 plan 的互补」。

## Runtime

### 可发现技能

- `zhanggui`（selective-hybrid strict orchestrator）
- `zhanggui-systematic-debugging`
- `zhanggui-test-driven-development`
- `zhanggui-using-git-worktrees`
- `zhanggui-dispatching-parallel-agents`
- `zhanggui-finishing-a-development-branch`
- `decision-notes`（独立入口，不参与根/leaf 路由）
- `setup-collaboration-files`（独立入口，不参与根/leaf 路由）

### 任务目录与迁移

当前版本继续使用 v0.4 WorkflowState 与 task-root schema。默认根仍为 `.tasks/`：不存在/空目录可采用并创建 `.zhanggui-root`；非空目录只有 marker 版本匹配才自动视为本工作流所有。默认根不可用时，项目根 `.zhanggui/config.yaml` 可用 `version` + 项目内相对 `task_root` 声明自定义根；否则使用确定性后备 `.zhanggui/tasks/`。完整细则见入口旁 [`RECOVERY.md`](skills/zhanggui/RECOVERY.md)。已有项目的旧任务目录只能显式采用、一次性导入或保留隔离，禁止静默合并和双写。

### 文档维护

生产代码的文件行数可作为拆分信号；Skill、STAGE 和设计文档不设 300 行硬上限。必要时按职责做 progressive disclosure，但不得为满足数字删除约束、示例或可读空白。

## 验证与验收命令

### Automated verification

```bash
npm test                                 # node --test "tests/**/*.test.mjs"
npm run validate                         # node scripts/validate-agent-skills.mjs
npm run check                            # 两者串跑
```

Expected: 68 tests / 68 pass / 0 fail；validator 最终行报告 `Validated 11 strict Agent Skills.`

测试命令**必须**限定在 `tests/`：`skills/*/evals/files/` 下的评测夹具是故意会失败的（比如 `buggy-cart` 有一个测试就该挂），裸跑 `node --test` 会把它当成仓库测试招进来。

validator 会给 Python 子进程注入 `PYTHONUTF8=1`，避免中文 Windows 语系下 GBK 解码 UTF-8 skill 文件时崩溃。

### Skill eval（两族）

方法、成本与当前状态见 [`evals/README.md`](evals/README.md)。两族不得混用：触发族回答“技能会不会加载”，质量族回答“加载后有没有比没技能更好”。

```bash
# 族 1：触发质量（标注语料 + 真 agent，看宿主实际加载了哪个技能）
npm run eval:triggers -- --dry-run
npm run eval:triggers -- --host claude --filter '^tdd-pos' --runs 1     # 先校准 adapter
npm run eval:triggers -- --host claude --out evals/results/triggers.json

# 族 2：输出质量（with_skill / without_skill 各跑一遍，看 delta）
npm run eval:quality -- --skill zhanggui-systematic-debugging --dry-run
npm run eval:quality -- --skill zhanggui-systematic-debugging --out evals/results/quality-debugging.json
```

两族语料已就位并通过结构校验（`tests/trigger-corpus.test.mjs` / `tests/quality-corpus.test.mjs`）。运行状态、速率与方差警告以 [`evals/README.md`](evals/README.md) 为唯一出处，本文不复述任何数字——复述过一次，几天内就过期了。全量触发评测是 144 条 × 3 次 = 432 次 agent 调用。

### 历史：旧判官 harness（非发布门槛）

```bash
node --test tests/skill-trigger-data.test.mjs
# 当前目录快照与测量状态在 evals/catalog-current.json（现为 pending-reevaluation）
# 历史测量：evals/results/v0.9-routing-summary.json（被取代的目录，含对照 arm）、evals/results/v0.8-routing-summary.json、evals/results/v0.7-routing-summary.json
```

旧做法让判官**只读 name + description 在候选里挑一个**，测出来的是“描述之间打不打架”，不是“技能会不会触发”：判官没有“这任务模型自己就能干、不必查技能”这个选项，用例又是作者手写、措辞贴近 description 原文，而且没有 train/validation 划分。它是廉价的描述冲突冒烟测试，**不是发布门槛，也不得当作触发率引用**。

Observed v0.9 summary facts（**历史**：对 v0.9 当时的 description 目录测得——三处修订后的 catalog，catalog 含 9 个 zhanggui 技能 + 6 个无关第三方干扰项，A/B 双 arm 同批判官模型，见 [`evals/results/v0.9-routing-summary.json`](evals/results/v0.9-routing-summary.json)）。该目录此后已按规范整体改写，下列速率**不描述当前目录**：

- 732/732 slots 有效（主批判官 deepseek-v4-flash:off；最后 4 个 root-side case 因该模型配额耗尽改用 glm-5.3-flash 补评，全部命中预期）
- 处理组 root rates: explicit/implicit/root-first-conflict = 1.0, root_false_positive = 0.019（全部满足阈值）
- 处理组 leaf: 正例除 dispatching 0.833（`dispatching-pos-03`，两 arm 一致，判官批次差异）外全部 1.0，含 tdd、worktrees、finishing——v0.8 的五个退化点全部消失
- 处理组 leaf 负例误触发全部 0（v0.8: worktrees 0.111 / dispatching 0.222 / finishing 0.167）
- 对照 arm（v0.7 旧 description 原文，同批判官）: root 同样达标，leaf 除 dispatching 0.833 外全部 1.0，负例全 0
- 判官提示词身份与 v0.8 相同（`evaluator_identity_sha256`）；judge harness 从每槽独立判断改为每 case 6 槽一批（见 summary `judge_note`），跨版本对比需带批次噪声前提

Observed v0.8 summary facts（**历史**：对归一化后、未做三处修订的 description 目录测得，见 [`evals/results/v0.8-routing-summary.json`](evals/results/v0.8-routing-summary.json)）：

- 122 cases × 3 runs × 2 arms = 732 slots，全部有效（transport 错误不计分，0 残余）
- transport retry policy: max 3 waves, backoffs `[0, 5, 15]`, transport-errors-only; valid wrong selections never retried
- 被测目录（treatment）root rates: explicit/implicit/root-first-conflict = 1.0, root_false_positive = 0.0（全部满足阈值）
- 被测目录 leaf: debugging/verification/receiving/dispatching/finishing positive = 1.0；tdd 0.833（`tdd-baseline-positive-02` 被 routing 到 debugging）、requesting 0.944、worktrees 0.889；负例误触发 worktrees 0.111 / dispatching 0.222 / finishing 0.167，其余 0
- 对照 arm（旧 description 原文，同批判官同干扰项）: root rates 同样 1.0/0/1.0；leaf positive tdd/receiving/worktrees/dispatching/finishing = 1.0, debugging/verification/requesting 0.944；负例误触发 worktrees 0.056 / dispatching 0.111 / finishing 0
- 相比对照 arm 的退化点（已记录于 summary `failures`，run 级明细在 `failure_evidence`）：tdd 正例 −0.167、worktrees 正例 −0.111、worktrees/dispatching/finishing 负例误触发 +0.056/+0.111/+0.167；其中只有 `tdd-pos-02`、`dispatching-neg-05`、`finishing-neg-01` 是 3/3 确定性误路由，其余为单次翻转、与对照 arm 噪音同量级（3 runs 的分辨率是 1/18 ≈ 0.056）。同一次归一化另把 debugging、verification 正例从 0.944 抬到 1.0。三个确定性用例已通过 description 修订处理并得到 v0.9 重测验证（见上）。
- focused trigger suite 10/10

Observed v0.7 summary facts（**历史**：对旧 description 目录测得，仅含 zhanggui 自身、不含干扰项，见 [`evals/results/v0.7-routing-summary.json`](evals/results/v0.7-routing-summary.json)）：

- 122 cases × 3 runs = 366 original slots
- final total attempts 393 (366 initial + 27 transport-only retries)
- transport retry policy: max 3 waves, backoffs `[0, 5, 15]`, transport-errors-only; valid wrong selections never retried
- root rates: explicit/implicit/root-first-conflict = 1.0, root_false_positive = 0.0
- all eight leaf positives = 1.0 / negatives = 0.0
- focused trigger suite 10/10

### Clean-host native activation

从仓库根运行，使用已认证 profile、不落盘 session、限制 catalog 为 Zhanggui 名称。每个 finite JSONL case 使用独立空系统临时 cwd，避免污染的仓库 cwd。

**Supported Task 5 cases (6/6):**

| ID | Expectation |
|---|---|
| `native-root-explicit` | OMP 交互式 `/skill:zhanggui ...` host-direct 注入根，root-first |
| `native-root-implicit` | 无命令高信号请求自动加载 `zhanggui`，首次工具前出现 `已自动进入 Zhanggui 完整工作流：` |
| `native-debug` | 窄 bug 请求先激活 `zhanggui-systematic-debugging`，根不抢占 |
| `native-root-conflict` | 端到端 + TDD/verification 子步骤仍 root-first |
| `fallback-debug` | `--no-skills` 下受控 collection fallback 读取 debugging leaf 并校验 frontmatter 身份 |

**Root（OMP 交互式，host-direct injection）：**

```bash
omp --no-session --no-rules --plugin-dir "$PWD" --skills "zhanggui*" --max-time 60
# then type interactively:
# /skill:zhanggui 设计并验证一个最小库存功能
```

期望：宿主在模型工作前直接注入 `zhanggui` 正文（TUI 可见 `✦ skill zhanggui ...` 与 `skills/zhanggui/SKILL.md` 路径），即 root-first。

**Implicit root / leaf / conflict（非交互 JSONL，独立 temp cwd）：**

```bash
# each case should use its own empty system-temp --cwd
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 \
  -p "我只有一个模糊的库存产品想法，请先查清需求和约束，再设计、实现并验证交付"
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 \
  -p "这个单元测试失败了，先系统化调查根因"
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 \
  -p "Own this end-to-end permissions redesign: resolve the open decisions, implement it with TDD, and carry it through final verification."
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 \
  -p "Review this cross-module diff only; do not implement, plan, or own end-to-end delivery."
```

期望：以 JSONL `tool_execution_*` / `skill://` 事件为准，不用助手散文冒充证据。

**Unsupported alias probe（excluded from supported totals）：**

```bash
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 \
  -p "/zhanggui 设计并验证一个最小库存功能"
```

`omp -p "/zhanggui ..."` 与非交互 `omp -p "/skill:zhanggui ..."` 在 OMP 中不是有效 native-root 证据（未知 slash 仅作普通文本）。该 probe 记录但排除在 supported totals 之外。

### Collection fallback

禁用 native skill discovery，只追加根说明并允许 collection 目录；同样使用独立空 temp cwd：

```bash
omp --no-session --no-rules --no-skills --cwd "$EMPTY_TEMP" \
  --append-system-prompt skills/zhanggui/SKILL.md --add-dir skills \
  --mode json --max-time 120 \
  -p "/zhanggui 调查一个测试失败；使用已安装 collection 的 fallback 加载调试流程。Installed collection root: $PWD/skills"
```

期望：native skill 不可用时，根通过受控 collection fallback 读取 `zhanggui-systematic-debugging`，frontmatter `name` 精确匹配；缺失/身份错误以稳定 blocked code 暴露。

## 验收场景

47 条权威验收场景见 [设计文档 §12](docs/skill-fusion-design.md)。建议的冒烟子集：Assisted 冷启动、Mixed 一次一问、原生提问分发、prototype detour 合并、design-drift、冷启动恢复、leaf Direct/Embedded 边界、selective Hybrid discovery、native clean-host activation、collection fallback identity。
