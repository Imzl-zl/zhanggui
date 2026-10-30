# description 对齐 Agent Skills 规范实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 11 条 `description` 从「只写触发条件」改为规范要求的「能力在前 + `Use when` 触发子句」，并让仓库纪律文档分清哪条是社区规范、哪条是本仓库自定。

**Architecture:** 只改 frontmatter 的 `description` 行与约束它的测试和规则文档，不动任何 `SKILL.md` 正文。九个被 `evals/catalog-current.json` digest 钉住的 description 全部变化，因此该快照按既有纪律转入 `pending-reevaluation`。

**Tech Stack:** Agent Skills Markdown、Node.js `node:test`、官方 `skills-ref`（通过 `uvx` 固定 revision）。

## Global Constraints

- 逐字保留每条既有触发关键词与前置条件，本批只做加法（v0.9 的三个误路由修复尤其不可回退）。
- 能力子句第三人称、不含步骤、不含行为指令。
- 不写 `do not use` / `defer to`；排除语义改写成正向前置条件，仲裁条款留在正文。
- `description` 仍为单行；上限由 500 提到 600，规范上限 1024 不变。
- 不改 `SKILL.md` 正文、`STAGE.md`、Completion Contract、路由谓词。
- 不改 `evals/results/v0.7|v0.8|v0.9-routing-summary.json`：已发布结果是只读历史记录。
- 任何情况下不得为了让 digest 门变绿而回填历史 summary。
- 新增机械门条件必须有 mutation probe，并实际验证过条件被改坏时会失败。

## File Map

| 文件 | 动作 |
|---|---|
| `skills/*/SKILL.md`（11 个） | 改：description 前置能力子句 |
| `tests/skill-discovery.test.mjs` | 改：`assertTriggerOnlyDescription` → `assertDiscoveryDescription`，上限 500→600 |
| `tests/skill-routing-contract.test.mjs` | 改：root / requesting / receiving 的前导断言 |
| `tests/skill-trigger-data.test.mjs` | 改：`supersedes` 指向 v0.9 + 新增 `APPROVED_V09_CATALOG_SHA256` |
| `evals/catalog-current.json` | 重建：entries / sha256 / status / supersedes / `target_case: null` |
| `AGENTS.md` | 改：description 纪律 + 规范分层表 |
| `README.md` | 改：v0.9 速率标注为历史、待重测说明 |
| `docs/history/README.md` | 改：差异表新增三行 |

## Tasks

- [x] **T1 核对一手规范**
  - 拉取 `agentskills.io/specification`、官方 `skills-ref` validator 源码、Anthropic best-practices。
  - 结论：`description` 强制项只有非空 + ≤1024；「只写触发条件」与规范冲突；规范无路由技能概念。

- [x] **T2 量化现状**
  - 逐条打印 11 条 description 与长度：全部以 `Use when` 开头，164–418 字符，无一条说明技能做什么。

- [x] **T3 重写 description**
  - 脚本化前置能力子句，保留原触发子句全文；替换前校验条唯一、能力子句不以 `Use when` 开头、结果仍含 `Use when`。
  - 结果：最长 548 字符（`init-project`），全部在 600 以内。

- [x] **T4 机械门改为正向结构检查**
  - `assertDiscoveryDescription`：≤600、不以 `Use when` 开头、以大写句开场、能力子句 ≥30 字符、触发子句 ≥10 字符、无否定选择子句、无行为指令、无步骤标记。
  - 补 8 条 mutation probe，覆盖每种拒绝路径与一条通过路径。

- [x] **T5 修正测试中的前导断言**
  - `skill-routing-contract.test.mjs` 的三处 `/^description: Use when\b/` 改为「大写句开场 + 含 `Use when`」。
  - 注意：文件是 CRLF，行首锚点必须带 `m` 标志（首次漏掉，测试立刻报出来）。

- [x] **T6 重建 digest 门**
  - `evals/catalog-current.json`：`status: pending-reevaluation`、`supersedes` 改指 v0.9、`source_head: null`、`changes_since_supersede` 写 `target_case: null` 并附逐技能能力子句。
  - 最终 catalog sha256：`85aca5ea937a13ae06279f61f091237704ccbd843a6ebe5b9310fea757b66b10`（旧 `4433554b…`）。

- [x] **T9 修掉 YAML 冒号并补机械门**
  - 首版能力子句里有 6 处 `": "`，官方 validator 直接报 `Invalid YAML in frontmatter: mapping values are not allowed here`（普通 YAML 标量不能含 `": "`）。
  - 关键点：本仓库的朴素 frontmatter 解析器（逐行 `indexOf`）读得下去，**只有官方 validator 报**，所以 `node --test` 当时是全绿的。
  - 处理：`": "` 改 `" — "`（共 6 处，另有一处能力子句同样改用破折号）；并把「description 必须是合法 YAML 普通标量」加进 `assertDiscoveryDescription`，补 `": "` 与 `" #"` 两条 probe。
  - 每改一次 description 就要重建一次 digest 门；本任务与 T6 共重建三次，以最后一次为准。

- [x] **T7 修正规则与文档**
  - `AGENTS.md`：description 纪律重写；新增「规范强制 / 规范建议 / 本仓库自定」分层表；说明规范无路由技能概念。
  - `README.md`：v0.9 速率改标为历史、声明不描述当前目录；折叠语句与 Trigger eval 索引同步。
  - `docs/history/README.md`：差异表新增三行。

- [x] **T8 验证**
  - `node --test`：63/63 pass。
  - `node scripts/validate-agent-skills.mjs`：`Validated 11 strict Agent Skills.`

## Verification

```bash
npm run check
```

期望：63 tests / 63 pass / 0 fail；`Validated 11 strict Agent Skills.`

## 未覆盖

- 未重测。当前目录为 `pending-reevaluation`，重测前不得引用任何一版历史命中率描述它。
- 未改动任何技能正文。
