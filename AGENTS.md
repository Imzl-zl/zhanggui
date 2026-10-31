# Zhanggui skills 项目规则

本仓库的产物是 skills 本身，不是应用代码。

## 单一真值源

`skills/` 是唯一真值源。以下目录全部是**生成产物**，不在其中修改规则：

- `~/.claude/skills/`（**只有 Claude Code 读**）、`~/.codex/skills/`、`~/.agents/skills/`（Codex / Copilot / Gemini / pi 的跨运行时别名）
- 仓库内 `.pi/`（本机开发工具快照，已 gitignore）

改规则改 `skills/`，再用 `scripts/deploy-skills.sh` 或宿主插件安装同步出去。

**宿主发现路径是实测结论，不是推测**：Claude Code **不读** `~/.agents/skills`——把技能只放在那里，Claude Code 一个都看不见（实测：同一临时 HOME 下放两个探针技能，`~/.claude/skills` 的那个出现在 skill 列表里，`~/.agents/skills` 的那个没出现）。所以 `.agents` 是给 Codex / Copilot / Gemini / pi 的共享点，Claude Code 那条路只能走 `~/.claude/skills` 或插件安装（`/plugin marketplace add <本仓库>`）。

仓库内**不再保留** `.claude/`、`.codex/` 快照：它们曾用于"让打开仓库的人直观看到该放哪儿"，但同类信息已由本文件的上一段和 `README.md` 的安装章节表达，留实体副本只会制造第二个真值源。

`.agents/skills/` 是例外：那里放开发本仓库用的第三方技能（vendored，与上游逐字节一致），不是交付物，也不得修改——改了就无法直接更新。详见 `.agents/skills/README.md`。

## 仓库结构

仓库根既是创作项目，也是分发单元（`.claude-plugin/plugin.json` + `.codex-plugin/plugin.json` 的 skills root 指向 `./skills/`）：

```text
skills/          # 唯一真值源，每个技能一个顶层目录
scripts/         # validate / deploy
tests/           # 路由与契约断言
evals/           # 触发数据集与运行记录；当前测量现状看 `evals/README.md`
docs/            # 当前设计论证；`docs/history/` 是已完成变更的快照，不是当前规则
.agents/skills/  # vendored 开发工具技能，不参与交付
```

技能只放在 `skills/` 下，不在仓库根平铺；新增技能自动进入校验与部署，无需改脚本里的名单。

### 协作文件体系的技能分工

`setup-collaboration-files` 与 `decision-notes` 是同一套体系的两半，靠**单向依赖**相连，不得互相复述规则：

- `setup-collaboration-files` 铺设骨架、写仓库不变量（根 `AGENTS.md` 军规、`.agents/notes/AGENTS.md`、`docs/AGENTS.md`），不写任何具体笔记，也不得复述四格模板与非平凡判定表。
- `decision-notes` 拥有笔记的格式、非平凡判定、状态迁移与取代流程；运行时先读目标仓库的 `.agents/notes/AGENTS.md`，不复述 `setup-collaboration-files` 的协作文件规则。

这条边界由 `tests/collaboration-contract.test.mjs` 机械卡住；改任一技能前先看那里的谓词。

## 目录约定

按 Agent Skills 规范组织每个技能目录：

```text
<skill-name>/
├── SKILL.md          # 必需；frontmatter 只用规范允许的字段，本仓库用 name / description / license（根额外用 compatibility）
├── references/       # 按需加载的文档
├── scripts/          # 可执行脚本
└── assets/           # 输出用模板、图标
```

不要把参考文档或脚本平铺在技能根目录，也不要把变更说明、集成记录一类的过程文档放进技能目录——那些进 `docs/`。

`name` 必须等于目录名；`SKILL.md` 保持在 500 行 / 5000 token 以内，超出就按职责拆到 `references/` 并在正文里写清何时加载哪个文件（“看 `references/` 里的细节”这种写法无效）。

## description 写法

description 是唯一的触发面：启动时宿主只注入 `name` + `description`，每个技能的元数据都进系统提示词，和对话历史争上下文。

开放规范（[`agentskills.io/specification`](https://agentskills.io/specification)）对它的要求是「既描述这个技能做什么，也描述何时用它」；官方作者指南（[Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)）补了两条：**一律用第三人称**（POV 不一致会导致发现失败），以及判官要在 **100+ 个技能**里选一个。规范的示例一律是**能力在前、`Use when` 触发子句在后**。

按以下约束写：

- **先写能力，再接 `Use when` 触发子句**。只写触发条件会让判官拿不到“能得到什么”这半个信号。
- 第三人称、单行（不用 `>-` 折叠块，否则快照校验的单行正则只能抓到标记）。
- 触发子句用用户真会说的具体症状和关键词（错误信息、现象、工具名），不用 `multi-deliverable` 这类内部术语。
- 不写步骤、不概述工作流——概述了模型会照 description 拄，不再读正文。
- 不写行为指令（“开场先说……”）；也不写 `do not use` / `defer to` 这类对自己的否定选择，排除语义改写成正向前置条件，仲裁条款留在正文。

机械门在 `tests/skill-discovery.test.mjs` 的 `assertDiscoveryDescription`：能力子句 ≥30 字符、必须带 `Use when` 触发子句、≤600 字符。600 是本仓库的上下文预算纪律，规范上限是 1024。

### 哪些是规范，哪些是本仓库自定

改规则前先分清层级，否则会用仓库习惯去覆盖规范，或把自定纪律当成硬要求：

| 层级 | 内容 |
|---|---|
| **规范强制**（官方 `skills-ref` validator 会拒） | 技能 = 含 `SKILL.md` 的目录；`name` ≤64、小写、不能首尾或连续连字符、**必须等于目录名**；`description` 非空且 ≤1024；frontmatter 只允许 `name` / `description` / `license` / `compatibility` / `metadata` / `allowed-tools`；description 必须是合法 YAML 普通标量（含 `: ` 或 ` #` 会让整个文件解析失败） |
| **规范建议**（不遵守会掉触发率） | description 同时说清“做什么”和“何时用”、用第三人称、含具体关键词、不概述工作流；`SKILL.md` 正文 <500 行 / <5000 token；引用只链一层深；渐进披露 |
| **本仓库自定** | 能力在前的固定句式、≤600 字符上限、禁 `do not use`、规则原文只在一处维护、契约改动同步 tests、mutation probe、先读 `writing-skills` |

规范里**没有“路由技能”这个概念**：启动时所有技能的 `name` + `description` 同时注入，每个技能独立被发现、在同一个池子里竞争。想让某个技能负责调度其他技能，只能靠它自己的 description 去赢，没有额外机制。

例外：`zhanggui` 与四个 `zhanggui-*` 的 description 被 `evals/catalog-current.json` 的 `catalog_snapshot` digest 钉住（`tests/skill-trigger-data.test.mjs` 会校验）。改它们必须同步那份快照，并在 `changes_since_supersede` 里写清改了哪个技能、针对哪个用例——没有对应失败用例时写 `target_case: null` 并说明这是规范对齐而非回归修复；`status` 在重测后置为 `measured`（`measured_by` 指向当次 summary），未重测时保持在 `pending-reevaluation`。已发布的 `results/v0.*-routing-summary.json` 是只读历史记录，任何情况下都不得为了让 digest 门变绿去改写它们（那等于让结果记录谎报产生该批速率的 catalog）。未重测前不得引用任何一版历史命中率描述当前目录。重测时 catalog 必须放入无关的第三方技能作为干扰项——v0.7 全程只开了 `--skills "zhanggui*"`，没测出竞争条件下的代价；v0.8 已按此要求重测并在 summary 中记录 `failures`。

判官只读 `name` + `description`（见 v0.8 summary 的 `routing_evaluation.system_prompt`）。SKILL.md 正文里的路由谓词管的是加载之后的运行时行为，在这套路由评测里恒为零变化，不要用它去修评测数字；反过来，description 里要表达排除语义时，写成正向前置条件（如 `subagent capacity is available`、`has already passed verification`），而不是被机械门禁掉的 `do not use`。

## 改动纪律

- 规则原文只在一处维护。README、`docs/` 和概念地图只做索引，不复述规则细节。
- 路由条件必须是可机械判定的谓词（如 `readiness ∈ {durable-plan, epic-plan}`），不写"高风险"这类需要模型自评的模糊条件——自评条件会被一路评成 false。
- 改路由或契约时同步 `tests/` 断言。新增条件要有对应测试，且必须验证过它在条件被改坏时真的会失败。
- 文档行数不作硬上限；不为凑数字删约束、示例或可读空白。
- 新建或大改技能先读 `.agents/skills/writing-skills`（上游 superpowers 的技能创作方法论：先用 subagent 压力场景拿 baseline 失败，再写技能，再验证合规）。

## 评测纪律

技能评测分两族，问题、方法、产物都不同，不得混用（完整方法见 `evals/README.md`）：

- **触发质量**：标注语料 + 真 agent，看宿主实际加载了哪个技能；每条 3 次、阈值 0.5；train/validation 划分固定；负例必须是 near-miss，而且要显式标成哪些技能的硬负例。优化对象是 description。
- **输出质量**：同题 with_skill / without_skill 各跑一遍，比通过率的 **delta**；delta ≤ 0 的技能没挣到它的 token，要么删要么改到能赢过基线。

硬约束：

- 只有 train 的失败可以指导 description 修改，按 validation 通过率挑最终版本。同一批用例既调参又报速率属于过拟合。
- 触发评测的判据是**宿主激活事件**，不是判官读 description 挑。判官看不到正文，别拿正文去改触发数字。
- 声明的速率必须来自真实运行；没跑过就写"未运行"，不写估计值，也不引用别人的数字。
- 已发布的 `evals/results/*-routing-summary.json` 只读；不得为了让 digest 门变绿而回填。
- 改动语料后同步 `tests/trigger-corpus.test.mjs` / `tests/quality-corpus.test.mjs` 的结构断言，并验证过条件被改坏时会失败。

## 验证

```bash
npm run check      # npm test + validate-agent-skills.mjs
npm test           # node --test "tests/**/*.test.mjs"
```

测试命令**必须**限定在 `tests/`：`skills/*/evals/files/` 下的夹具是故意会失败的（比如 `buggy-cart`），裸跑 `node --test` 会把它当成仓库测试招进来。

`npm test` 期望 70 tests / 70 pass / 0 fail；validator 期望末行 `Validated 7 strict Agent Skills.`。

改完 skills 后至少跑一次 `npm run check`，再跑 `./scripts/deploy-skills.sh --target <host> --dry-run` 确认部署差异符合预期。
