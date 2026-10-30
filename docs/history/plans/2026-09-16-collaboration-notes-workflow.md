# 协作文件体系补全实施计划（init-project + decision-notes）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `init-project` 从"两根支柱"补成三支柱（根 `AGENTS.md` / `docs/` / `.agents/notes/`），并新增 `decision-notes` 作为运行时写笔记的技能；两者以一条单向依赖相连，任一方向都不得复述对方的规则。

**Architecture:** `init-project` 铺设骨架并写仓库不变量（根 `AGENTS.md` 军规、`.agents/notes/AGENTS.md`、`docs/AGENTS.md`），一次性执行；`decision-notes` 拥有笔记的格式、非平凡判定、状态迁移与取代流程，每次改动执行。耦合点只有 `.agents/notes/AGENTS.md` 这份仓库运行时契约。两者都是 standalone 技能，不进入根/leaf 路由，不拥有编排状态。

**Tech Stack:** Agent Skills Markdown、Node.js `node:test`、官方 `skills-ref`（通过 `uvx` 固定 revision）。

## Global Constraints

- `skills/` 是唯一真值源；宿主 skills 目录与仓库内 `.claude/`、`.codex/`、`.pi/` 是生成产物，不在那里改规则。
- `init-project` 不得复述笔记四格模板与非平凡判定表；`decision-notes` 不得复述协作文件规则与 `memory.md` 生命周期。
- 两个新/改技能都必须通过 strict Agent Skills validator；frontmatter 只用 `name` / `description` / `license`。
- description 只写触发条件：以 `Use when` 开头，不写否定选择子句、不写行为指令、≤500 字符。
- standalone 技能正文不得出现 `WorkflowState`，不得有 `## Invocation Modes` 段。
- `SKILL.md` 保持在 500 行以内；超出的细节按职责下沉到 `references/`，并在正文写清何时加载哪个文件。
- 旧的 `memory/archive/` 内容不删除、不追加、不迁移；只在总结里给迁移建议。
- 不改动十个已发布技能中九个被评测技能的 `description`，否则会移动 `evals/catalog-current.json` 的 digest 门。
- 新增断言必须带 mutation probe，并实际验证过条件被改坏时会失败。
- 每个任务完成后运行该任务的 focused test；收尾运行完整 `npm run check`。

---

## File Map

| 文件 | 动作 |
|---|---|
| `skills/decision-notes/SKILL.md` | 新建：运行时流程与读取顺序 |
| `skills/decision-notes/references/notes-contract.md` | 新建：笔记体系唯一规则真值源 |
| `skills/decision-notes/references/note-template.md` | 新建：骨架、落盘路径、已落地示例、反例 |
| `skills/init-project/SKILL.md` | 重写：三支柱、生成策略、12 步 workflow、两道门 |
| `skills/init-project/references/rules.md` | 重写：32 条硬规则 + 归一原则 + 失效项区分 |
| `skills/init-project/references/templates.md` | 重写：`AGENTS.md` / 子目录 / `docs/AGENTS.md` / `architecture.md` / `notes/AGENTS.md` / `tools.md` / `memory.md` 模板 |
| `skills/init-project/references/scan-signals.md` | 新建：Step 2 扫描清单（从 `SKILL.md` 下沉） |
| `commands/init-project.md` | 改 description |
| `commands/decision-notes.md` | 新建薄壳 |
| `tests/skill-discovery.test.mjs` | 改：standalone 名单、技能数、manifest 契约 |
| `tests/collaboration-contract.test.mjs` | 新建：两技能边界与笔记契约断言 + mutation probe |
| `AGENTS.md`、`README.md`、`package.json`、三个 plugin manifest、`docs/skill-fusion-design.md` | 改：计数、构成、版本、结构树 |
| `docs/history/README.md` | 改：差异表新增两行 |

## Tasks

- [x] **T1 建立笔记契约技能 `decision-notes`**
  - 新建 `SKILL.md`（判定 → 定状态 → 起草四格 → 落盘 → 代码回指 → 取代 → 验收）与两份 reference。
  - 契约必须含 6 类非平凡判定表、纯机械反面清单、四格硬约束、目录状态语义、禁止总索引、取代与冻结、与相邻目录的边界、验收清单。
  - 验证：`node scripts/validate-agent-skills.mjs` 报 `Valid skill: .../decision-notes`。

- [x] **T2 重写 `init-project` 目标结构为三支柱**
  - `SKILL.md` 增加产物表、三支柱边界、根 `AGENTS.md` 生成策略与字数预算。
  - 新增 Step 6 `docs/` 条件归一（归一 / 最小索引 / 跳过三态）。
  - 新增 Step 9 `.agents/notes/` 骨架，只写不变量。
  - `memory.md` 删除"关键决策"节。

- [x] **T3 退役月度流水并处理旧仓库**
  - 删除 `memory/archive` 模板；新增 Step 10 处理既有 `memory/archive/`：保留不动、不再追加、给迁移建议、不擅自搬迁。
  - 差异表登记该行为变更。

- [x] **T4 修正归一方向**
  - Quality Gate 与硬规则改为区分两类内容：失效**旧规则**删除；**已发生的决定**只标注被谁取代后移入 `archived/`，结论不改。

- [x] **T5 建立单向依赖**
  - `init-project` 不得出现 `## Alternatives considered` / `## Consequences` 标题；必须在正文与根 `AGENTS.md` 模板中指名 `decision-notes`。
  - `decision-notes` 运行时先读 `.agents/notes/AGENTS.md`，冲突时服从仓库并在总结里点名。

- [x] **T6 包装面同步**
  - `commands/decision-notes.md` 薄壳；`commands/init-project.md` description 补 `docs/`、`.agents/notes/`。
  - 三个 plugin manifest、`package.json`、`README.md`、`AGENTS.md`、`docs/skill-fusion-design.md` 的计数与构成串更新。
  - 集合打包版本 `0.8.0` → `0.9.0`，测试内 pin 同步改名 `assertPluginManifestV09`。

- [x] **T7 契约断言与 mutation probe**
  - 新建 `tests/collaboration-contract.test.mjs`：笔记格式单一所有权、decision-notes 契约完整性、scope 隔离、快照无决策节、字数预算声明、取代纪律。
  - 每个谓词配 mutation probe；`replace` 改 `replaceAll` 后复验探针真的会失败。

- [x] **T8 验证**
  - `node --test`：63/63 pass。
  - `node scripts/validate-agent-skills.mjs`：`Validated 11 strict Agent Skills.`
  - `bash scripts/deploy-skills.sh --target agents --dry-run`：11 owned skills，差异符合预期。

## Verification

```bash
npm run check
./scripts/deploy-skills.sh --target agents --dry-run
```

期望：63 tests / 63 pass / 0 fail；`Validated 11 strict Agent Skills.`；dry-run 列出 11 个技能且包含 `decision-notes`。

## 未覆盖

- 两个 standalone 技能不在 `evaluatedSkills` 内，本次未改 `evals/catalog-current.json`，也未新增触发数据集。
- 未引入 `docs/` 字数与去废话词的机械校验脚本。
