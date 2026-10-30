# 评测方法论对齐 Agent Skills 社区规范设计

**状态：** 已实施（语料就位，尚未运行）
**日期：** 2026-09-16
**目标版本：** v0.9.0
**适用范围：** `evals/`、`scripts/run-*.mjs`、`tests/trigger-corpus.test.mjs`、`tests/quality-corpus.test.mjs`、`AGENTS.md`

## 1. 背景与证据

本仓库此前的评测是**让判官只读 `name` + `description` 在候选里挑一个技能**，122 条手写用例 × 3 runs × 双 arm，阈值写在 `evals/skill-triggering.json`。核对社区一手资料后确认它测的不是"触发"：

- 官方 [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) 定义的触发判据是**宿主实际加载了 `SKILL.md`**（示例脚本读 `claude -p --output-format json` 的 `Skill` 工具调用），并把 trigger rate 的默认阈值定为 0.5、每技能约 20 条用例（8–10 正 / 8–10 负）、负例必须是 near-miss、train/validation 固定划分、迭代 ≤5 次并按 validation 通过率选版本。
- 同一篇明确写出："agents typically only consult skills for tasks that require knowledge or capabilities beyond what they can handle alone. A simple, one-step request like 'read this PDF' may not trigger a PDF skill even if the description matches perfectly." 旧 harness 的判官被要求从 catalog 里挑一个或 null，**没有"模型自己就能干、不必查技能"这个选项**，口径系统性偏宽。
- 官方 [Evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills) 定义的第二族是 with_skill / without_skill 对照，逐条 assertion 打分并要求证据，**承重指标是 delta**。本仓库此前完全没有这一族。
- 社区明确反对混用两族："Conflating them leads to eval configs that are noisy, hard to maintain, and unreliable."

最严重的一条是**过拟合**：`catalog-current.json` 的 `changes_since_supersede` 自己写着三处修订针对 `tdd-pos-02`、`finishing-neg-01`、`dispatching-neg-05`，然后 v0.9 在**同一套 122 条**上报告"三个退化点全部消失"。官方对这种情况的定义就是过拟合："Only use train set failures to guide your changes."

## 2. 已确认决策

1. **建立两族，分开维护，绝不混用。** 触发族回答"会不会加载"，质量族回答"加载后有没有用"。
2. **触发语料全域一份**（`evals/triggers/catalog-queries.json`，144 条），因为 description 在同一个 catalog 里互相竞争；这套还借用了本仓库不需要"每技能一个文件"的形态，并把 `near_miss_for` 显式标成"这条是哪些技能的硬负例"。
3. **`expected_skill: null` 表示不该触发任何技能**，root 误触发率从这里看。
4. **train/validation 固定划分**（93/51，`split_sha256` 钉住），并按上游规则约束：只有 train 的失败能指导修改，按 validation 通过率挑版本。改划分与改 description 不得同批。
5. **触发检测用宿主激活事件，不用判官。** `claude` adapter 照抄上游示例脚本；`omp` / `codex` 标为启发式，要求先用小 `--filter` 校准。
6. **建立质量族**：官方格式 `skills/<skill>/evals/evals.json` + `evals/files/` 夹具 + with/without 对照 + delta；每个夹具声明 `fixture_baseline` 且被测试实际跑一遍验证。
7. **旧 harness 降级**：保留数据与 summary（只读历史），但明确标注它是"description 冲突冒烟测试"，**不是发布门槛、不得当作触发率引用**；`required_before_claiming_rates` 改为社区口径。
8. **仓库测试命令限定到 `tests/`。** 夹具是故意会失败的，裸跑 `node --test` 会把它们招进仓库测试。

## 3. 被放弃的方案

1. **删掉旧 harness 和它的 122 条用例。**
   - 最强的理由：它不是社区方法，留着会被继续误用；删掉最干净，也省掉维护两套的成本。
   - 为何被否：它抓过 3/3 的确定性误路由，作为**廉价的描述冲突冒烟测试**仍有价值；三份已发布 summary 是只读证据，删除等于销毁"当时为什么这么改"的溯源。改为降级 + 明确标注，比删除诚实。
2. **在旧判官 harness 上打补丁：给它加一个"无需技能"选项、加 train/validation 划分、提高 runs。**
   - 最强的理由：改动最小，历史可连续比较，已投入的 122 条用例与判官基建都能复用。
   - 为何被否：判官读不到宿主是否真的激活，补丁改不掉"代理指标"这个根本属性；而且每加一层模拟就更远离真实激活路径。要拿到真实触发率只能真跑 agent。
3. **每技能一个 `triggers/<skill>.json`（严格照上游布局）。**
   - 最强的理由：与上游文档逐字对应，工具兼容性最好。
   - 为何被否：上游形态假设技能彼此独立；本仓库的技能在同一个 catalog 里互相抢流量，收紧一个描述会把流量推给另一个。全域一份 + `near_miss_for` 显式标注更贴合本仓库，且在 `evals/README.md` 里写清了这是有意的偏离。
4. **本轮就把触发评测全量跑完。**
   - 最强的理由：只有跑过才有数字，语料不跑等于没评测。
   - 为何被否：144 × 3 = 432 次 agent 调用，且两个 adapter 尚未校准；未校准就跑全量，产出的数字不可信。本轮交付语料 + runner + 结构门，运行单独排期。
5. **把质量语料写在仓库根 `evals/quality/`。**
   - 最强的理由：所有评测集中一处，好找，也不增加技能包的体积。
   - 为何被否：上游约定是 `skills/<skill>/evals/evals.json`，夹具相对技能目录解析；评测与技能同版本演化时，放在技能内才不会错配。

## 4. 已知代价

- **两族都尚未运行**：当前目录没有有效的触发速率，也没有质量 delta。任何数字都不得引用，包括 README 里的 v0.9 历史速率（已显式标注为不描述当前目录）。
- 全量触发评测成本 432 次 agent 调用；`omp` / `codex` 两个 adapter 是在未校准状态下交付的，首次使用必须先跑小 `--filter`。
- 质量族目前只覆盖两个技能（debugging、tdd），其余九个没有语料，所以"这个技能值不值"对多数技能仍无答案。
- 语料由作者手写，可能标注有误。上游对此的态度是"如果几个迭代都没提升，问题可能出在语料上"——首次运行后需要按失败用例回头修语料。
- 仓库测试命令从 `node --test` 改为 `node --test "tests/**/*.test.mjs"`，是一个显式的行为变更，已登记在 `docs/history/README.md` 的差异表。
- 夹具进了技能目录，安装单元因此变大（两个夹具合计 6 个小文件）。

## 5. 本批未引入

- 未运行任何一族评测，未产生任何新速率。
- 未为其余九个技能写质量语料。
- 未回填 v0.6–v0.9 的历史 summary。
- 未把触发评测接进 CI（需要先校准 adapter 并确认成本）。
