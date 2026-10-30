# 评测方法论对齐社区规范实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把仓库的评测从"判官只读 description 挑一个技能"换成社区标准的两族方法：真 agent 观测激活的**触发族** + with/without 对照看 **delta** 的质量族，并把旧 harness 降级为廉价的描述冲突检查。

**Architecture:** 触发语料全域一份（`evals/triggers/catalog-queries.json`）+ `scripts/run-trigger-eval.mjs`；质量语料按上游约定放在 `skills/<skill>/evals/evals.json` + `scripts/run-quality-eval.mjs`。两族的语料结构各由一个测试文件机械卡住；runner 只负责跑与评分，不写进仓库测试。

**Tech Stack:** Agent Skills Markdown、Node.js 24 `node:test`、官方 `skills-ref`（`uvx` 固定 revision）、宿主 CLI（`claude` / `omp` / `codex`）。

## Global Constraints

- 两族不得混用：触发族不得读质量断言，质量族不得读路由结果。
- 触发判据是宿主的激活事件，不是判官判断。
- train/validation 划分固定并由 `split_sha256` 钉住；改划分不得与改 description 同批。
- 只有 train 的失败可以指导 description 修改，按 validation 通过率选版本。
- 负例必须是 near-miss，并用 `near_miss_for` 显式标注；明显无关的问题只用于 `expected_skill: null` 的 root 误触发面。
- 声明的速率必须来自真实运行；未运行就写"未运行"。
- 已发布的 `results/v0.6..v0.9-routing-summary.json` 只读，任何情况下不回填。
- 新增机械门必须带 mutation probe，并验证过条件被改坏时会失败。
- 仓库测试命令限定 `tests/**/*.test.mjs`：`skills/*/evals/files/` 下的夹具是故意会失败的。

## File Map

| 文件 | 动作 |
|---|---|
| `evals/triggers/catalog-queries.json` | 新建：144 条全域触发语料 + 固定划分 + `near_miss_for` |
| `scripts/run-trigger-eval.mjs` | 新建：真 agent 触发 runner（3 个 host adapter + recall/precision） |
| `evals/README.md` | 重写：两族方法论、运行方式、成本、旧 harness 的定位 |
| `skills/zhanggui-systematic-debugging/evals/{evals.json,files/buggy-cart/**}` | 新建：质量语料 + 故意失败的夹具 |
| `skills/zhanggui-test-driven-development/evals/{evals.json,files/fresh-cart/**}` | 新建：质量语料 + 全绿夹具 |
| `scripts/run-quality-eval.mjs` | 新建：with/without 对照 runner + delta |
| `tests/trigger-corpus.test.mjs` | 新建：语料结构门 + mutation probe |
| `tests/quality-corpus.test.mjs` | 新建：质量语料门 + 夹具 baseline 实跑校验 |
| `package.json` | 改：测试命令限定 `tests/`，新增 `eval:triggers` / `eval:quality` |
| `evals/catalog-current.json` | 改：`required_before_claiming_rates` 换成社区口径，`measured_by` 标注为旧族 |
| `AGENTS.md`、`README.md` | 改：新增评测纪律，重写验证与 eval 章节 |
| `docs/history/README.md` | 改：差异表新增两行 |

## Tasks

- [x] **T1 核对社区方法论**
  - 拉取官方 `optimizing-descriptions.mdx` 与 `evaluating-skills.mdx`，确认判据（宿主激活）、默认阈值 0.5、约 20 条/技能、near-miss 负例、train/validation、delta 承重。

- [x] **T2 建触发语料**
  - 144 条：每技能 10 条正例，33 条 `expected_skill: null`，其余为跨技能硬负例。
  - 首版划分比 0.68 且 tdd / init-project / decision-notes / zhanggui 的硬负例不足 6 条，补 14 条定向负例并把 6 条正例移入 validation，收敛到 93/51。
  - `split_sha256` 由 `id + split` 投影算出并写回文件。

- [x] **T3 触发语料结构门**
  - `tests/trigger-corpus.test.mjs`：query 数下限、每技能正例下限、每技能硬负例下限、null-target 下限、划分比区间、id 唯一、`expected_skill`/`near_miss_for` 必须在 catalog 内、不得把自己列为自己的 near-miss；6 条 mutation probe；另有一条 digest 测试钉住划分。

- [x] **T4 触发 runner**
  - `scripts/run-trigger-eval.mjs`：claude（照抄上游示例脚本的检测）/ omp / codex 三个 adapter，`--dry-run` / `--filter` / `--runs` / `--split` / `--out`；按 run 计 recall/precision，另有 null-target 清洁率；0 次成功调用时不写报告并报错退出。
  - 首版残留了一段无用的 `require0` 包装与重复字段，已清理。

- [x] **T5 质量族**
  - 官方布局 + `fixture_baseline`；runner 支持机械判定（文件存在 / JSON 合法）与判官回退，判官提示词身份哈希记进报告；delta 为承重指标。
  - 夹具 `buggy-cart`（3 tests / 1 fail，根因是折扣按首件商品判断）与 `fresh-cart`（3 tests / 0 fail），均在本地实跑验证。

- [x] **T6 质量语料门**
  - `tests/quality-corpus.test.mjs`：schema、用例数区间、assertion 非空、夹具存在且非空、`fixture_baseline` 必须声明并实跑验证；5 条 mutation probe。

- [x] **T7 修掉测试命令的夹具污染**
  - `node --test` 会把 `skills/*/evals/files/**/test/*.test.js` 当成仓库测试，`npm run check` 因此变红。
  - 改为 `node --test "tests/**/*.test.mjs"`（`node --test tests/` 会被当成模块路径，不可用）。
  - 顺带修掉一个真陷阱：父测试运行器会把 `NODE_TEST_CONTEXT` 传给子进程，子进程里的 `node --test` 于是静默退出 0，**故意失败的夹具会变绿**。夹具校验必须清掉该环境变量。

- [x] **T8 降级旧 harness 并改规范文档**
  - `evals/README.md` 重写为两族方法论；`AGENTS.md` 新增评测纪律；`README.md` 的 eval 章节分成"两族"与"历史：旧判官 harness（非发布门槛）"。
  - `evals/catalog-current.json` 的 `required_before_claiming_rates` 改成社区口径，`measured_by` 标注 `family: legacy judge harness`。

- [x] **T9 验证**
  - `npm run check`：68/68 pass，`Validated 11 strict Agent Skills.`
  - 两个 runner 的 `--dry-run` 均可运行。

## Verification

```bash
npm run check
npm run eval:triggers -- --dry-run
npm run eval:quality -- --skill zhanggui-systematic-debugging --dry-run
```

期望：68 tests / 68 pass / 0 fail；`Validated 11 strict Agent Skills.`；两个 dry-run 列出计划且不发起调用。

## 未覆盖

- 未运行任何一族评测，因此当前目录没有触发速率也没有质量 delta。
- `omp` / `codex` adapter 未校准。
- 其余九个技能没有质量语料。
- 未接 CI。
