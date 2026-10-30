# evals — 技能评测

技能评测分**两族**,问题不同、方法不同、产物不同,**绝不混用**。混在一起会让执行评测变 flaky(被路由噪声污染)、让触发评测变粗(继承了执行断言),而且失败时无法判断"是技能错了,还是加载错了技能"。

| | 族 1:触发质量 | 族 2:输出质量 |
|---|---|---|
| 问的问题 | 该触发的时候,技能真的加载了吗? | 加载之后,结果比"没有这个技能"更好吗? |
| 信号性质 | 确定性的(宿主自己报"哪个技能加载了") | 需要评分(rubric / 判官) |
| 方法 | 标注语料 + 真 agent + 看激活事件 | 同题跑两遍(with / without),比对通过率 delta |
| 优化的对象 | description | 技能正文与脚本 |
| 失败形态 | 该触发没触发 / 不该触发乱触发 | 输出不对 |
| 产物 | `run-trigger-eval.mjs` 的报告(recall / precision) | `run-quality-eval.mjs` 的报告(delta) |

**判官只读 `name` + `description`,正文里的路由谓词在这套评测里恒为零变化。** 别用正文去修触发数字,也别用触发数字去证明输出质量。

## 目录

```text
evals/
├── triggers/catalog-queries.json   # 族 1 语料:144 条标注 query,全域一份
├── catalog-current.json            # 当前 description 目录的 digest 门 + 测量状态
├── results/                        # 运行记录(只读历史 + 待写入的新报告)
├── skill-triggering.json           # 旧的判官式用例集,见"历史"一节
└── run-*.mjs / build-*.py          # 旧判官 harness 的运行脚本
```

族 2 的语料按上游约定放在技能目录内:`skills/<skill>/evals/evals.json`,夹具在 `skills/<skill>/evals/files/`。

## 族 1:触发评测

```bash
npm run eval:triggers -- --dry-run
npm run eval:triggers -- --host claude --filter '^tdd-pos' --runs 1     # 先校准 adapter
npm run eval:triggers -- --host claude --split train --concurrency 8 --out evals/results/triggers.json
npm run eval:triggers -- --host claude --split validation \
  --descriptions evals/candidates/train-run1-descriptions.json   # 对照另一版目录
```

**其他开关**：`--concurrency`（默认 4，query 之间无共享状态）、`--timeout-ms`、`--fixture <dir>`（先铺一个真实 git 工作区再跑，见下）、`--descriptions <file>`（把候选 description 覆盖进本次 staging，只作用于本次运行）。

**一次运行的成本现实**：432 次 agent 调用要按小时算，且**驱动模型是测量条件的一部分**。同一语料同一 catalog 在 `deepseek-flash` 下 train 通过率 0.656、在 `qwen3.8-flash` 下 0.914 —— 报告里的 `driving_model` 不是附注，是速率的一部分。

**方法**(对齐 [Optimizing skill descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)):

- 每条 query 跑 **3 次**,算 trigger rate;`>= 0.5` 判通过,`< 0.5` 判失败。阈值就是上游默认值。
- 判据是**宿主真的加载了哪个技能**,不是判官读 description 猜。所以这个断言是确定性的,可以进 CI。
- 语料**全域一份**,不是每技能一个文件:description 在同一个 catalog 里互相竞争,收紧一个会把流量推给另一个,必须整套一起测。
- 负例必须是 **near-miss**(共享关键词但需求不同),明显的无关问题是弱负例,什么也测不到。语料用 `near_miss_for` 显式标注每条 query 是哪些技能的硬负例。
- **train / validation 固定划分**(约 60/40,`split_sha256` 钉住):**只用 train 的失败指导 description 修改**,按 validation 通过率挑最终版本。改 description 的同时改划分,等于把比较作废。
- `expected_skill: null` 表示这条 query 不该触发任何技能,root 的误触发率从这里看。

**成本**:144 条 × 3 次 = 432 次 agent 调用。所以先用 `--filter` 在几条 query 上校准 adapter,再跑全量。

**adapter 状态**：`claude` 是参考 adapter，调用形态为 `claude -p <query> --output-format stream-json --verbose`，检测 `assistant` 事件里的 `Skill` 工具调用。上游示例脚本读的是 `--output-format json` 的 `messages`，**当前 CLI 的该输出不含这个字段**，照抄会让每条 query 都判 fail；`stream-json` 才有 transcript 形态。`omp` / `codex` 仍是按 clean-host 验收命令事件形状写的**启发式**，未校准，首次使用必须用小 `--filter` 校准后再跑全量。

**激活是一个列表**：一次请求可以先加载 `zhanggui` 再加载 leaf，评分按成员判定，因此 precision 能看见“顺带加载了别的技能”。`should-trigger-nothing` 的通过条件按语料 `method` 原文（trigger rate < threshold）计算。

**工作区对照（`--fixture`）**：语料里不少 query 指称具体物件（“这个 diff”、“这个单测昨天还好好的”），而 runner 默认只铺 `.claude/skills`。`evals/workspace/` 是一个小 Node 项目骨架（一个故意失败的测试、一次未提交改动），用它做同一批 query 的对照。实测结果**否定**了“缺工作区导致不触发”这个假设：已完成的 14 条对照全部仍失败，transcript 显示模型认真做了活但从未考虑 catalog。它保留为可选对照，不是默认配置。

**宿主自带技能关不掉**：`claude` CLI 自带的 `code-review`、`verify`、`debug`、`simplify` 等会在同场竞争（把 `HOME` / `USERPROFILE` / `CLAUDE_CONFIG_DIR` 全指向干净目录也仍在）。它们不计入 catalog 加载，但确实抢流量。

## 族 2:输出质量

```bash
npm run eval:quality -- --skill zhanggui-systematic-debugging --dry-run
npm run eval:quality -- --skill zhanggui-systematic-debugging --out evals/results/quality-debugging.json
```

agent 臂以 `--dangerously-skip-permissions` 启动：默认权限模式下 Bash 与 Write 全被拒，两臂都退化成读代码，delta 测的就不是技能。判官臂不给这个开关（判官不需要工具）。报告里的 `skill_activations` 记的是 with_skill 臂**是否真的加载了技能**——不记这个，delta=0 无法解释。判官看到的是 `buildTranscript` 压缩出的 `TOOL / RESULT / TEXT` 时序日志，不是 stream-json 原文的尾部（尾部会截掉 red 阶段）。

**方法**(对齐 [Evaluating skill output quality](https://agentskills.io/skill-creation/evaluating-skills)):

- 每个用例跑两遍:**with_skill** 与 **without_skill**(基线),各自在干净临时工作区里跑。
- 逐条 assertion 打分,要求 **PASS 必须给出引用输出的具体证据**,不许"看着还行"。
- 能机械判定的先机械判定(文件存在、JSON 合法),其余交判官;判官提示词**身份哈希**记进报告,两份报告只有身份一致才可比。
- **delta(有技能 − 无技能)是承重指标**。delta ≤ 0 的技能没挣到它的 token:要么删掉,要么改到能赢过基线。
- 夹具必须声明 `fixture_baseline`(`passing` / `failing`),由 `tests/quality-corpus.test.mjs` 实际跑一遍验证。故意失败的夹具一旦悄悄变绿,依赖它的用例就什么也没在测。

**当前覆盖**:`zhanggui-systematic-debugging`(2 例,夹具 `buggy-cart` 故意 1 个测试失败)与 `zhanggui-test-driven-development`(2 例,夹具 `fresh-cart` 全绿)。其余技能尚未写语料。

## 当前状态

两族均已首次实跑。完整方法与代价见 [`../docs/history/specs/2026-09-16-first-eval-runs-design.md`](../docs/history/specs/2026-09-16-first-eval-runs-design.md)。

**测量条件（不是附注）**：host `claude`（参考 adapter，`stream-json --verbose`）、本机 Anthropic 兼容端点、驱动模型 `qwen3.8-flash`、并发 8。宿主自带技能在同场竞争且关不掉。

触发族（阈值 0.5，每 query 3 次）：

| 报告 | split | 通过 | 说明 |
|---|---|---|---|
| `results/triggers-train-run1.json` | train | 85/93 = 0.914 | 改前 catalog 的基线 |
| `results/triggers-train-run2.json` | train | 86/93 = 0.925 | 按 train 失败改 description 之后 |
| `results/triggers-validation-candidate-baseline.json` | validation | 48/51 = 0.941 | 改前 catalog（`evals/candidates/train-run1-descriptions.json`） |
| `results/triggers-validation-revised.json` | validation | 48/51 = 0.941 | 当前工作树 |

**validation 打平**，因此当前 catalog 不是“验证出来的更好版本”。唯一在两个划分上同号的改动是 `zhanggui-requesting-code-review` 的召回（train 0.556→0.833，validation 0.500→0.750），其机制可解释：此前被宿主内置 `code-review` 抢掉的 query 现在收回。其余逐技能差异在 train / validation 之间反向变号，属 n=2~3 次重复的方差。

`results/triggers-train-DISCARDED-ratelimited.json` 是**作废**记录：那次运行有 81/279 次调用因端点限流（11 请求/分钟）失败，不得引用其速率。

`results/triggers-DISCARDED-spark-subset-{broad,current}.json` 是**作废**记录：2026-10-30 用 `spark-x2.6`（xf-yun `/anthropic` 端点、`claude` host）跑 `zg` + `nul` + `nm` 共 44 条 × 1 run × 2 臂，81 次成功调用里只有 **1 次**触发了技能。该模型不按 Claude Code 的技能协议先调 `Skill`，于是 `nul` / `nm` 这两个"不该触发"的分组白送分，两臂差异（宽 1 次 vs 窄 0 次）只等于一个事件。它测的是模型习惯，不是 description，任何速率都不得引用。顺带记一条可复用的结论：触发族要求驱动模型会遵循技能协议，`spark-x2.6` 适合当质量族判官或写作用第二意见，不适合做触发测量。

质量族（每技能 2 例，每臂 1 次）：

| 技能 | with_skill | without_skill | delta | 报告 |
|---|---|---|---|---|
| `zhanggui-systematic-debugging` | 1.000 | 0.667 | **+0.333** | `results/quality-debugging.json` |
| `zhanggui-test-driven-development` | 1.000 | 0.833 | **+0.167** | `results/quality-tdd.json` |

两例的 with 臂都确认加载了对应技能、without 臂都没有。**方差警告**：每技能 2 例、每臂 1 次，delta 在配置微调之间摆动明显，这组数字只能作为“技能目前跑赢了自己的基线”，不足以判断稳定性。

`evals/catalog-current.json` 的 `status` 仍为 `pending-reevaluation`：当前目录的触发数字由新的触发族产出，而该门的 `measured` 分支要求一份判官 harness 形态的 summary，本批没有为让门变绿去改它。

## 历史:旧判官 harness

`skill-triggering.json`(122 条)+ `run-v0.9-*.mjs` / `build-v0.9-*.py` + `results/v0.6..v0.9-routing-summary.json` 是 2026-09-16 之前的做法。

它的做法是**让判官只读 name + description 在候选里挑一个**,测出来的是"描述之间打不打架",**不是"技能会不会触发"**。局限:

- 判官没有"这任务模型自己就能干、根本不必查技能"这个选项,所以口径比真实激活宽。
- 用例由作者手写、措辞贴近 description 原文,测的是词汇重叠。
- 没有 train/validation 划分:几处修订是针对具体失败用例做的,又在同一批用例上报速率,按上游定义属于**过拟合**。

保留它的理由:它确实抓到过 3/3 的确定性误路由,是**廉价的描述冲突冒烟测试**。但它的输出:

- **不是发布门槛**;
- **不得当作触发率引用**;
- 已发布的 summary 是只读历史记录,任何情况下都不回填。

读它们的正确姿势:把它当"description 冲突检查",不当"技能触发测量"。
