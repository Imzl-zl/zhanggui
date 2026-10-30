# 两族评测首次实跑实施计划

**Goal:** 把已就位的触发族与质量族真跑一遍，拿到真实数字；按 train 失败改 description，按 validation 通过率挑版本；把过程中暴露的 harness 缺陷修掉，而不是绕过。

**Architecture:** 不改语料、不改划分。改动集中在 `scripts/run-trigger-eval.mjs` 与 `scripts/run-quality-eval.mjs`（检测、评分、并发、诊断、对照开关），新增两个可选对照入口（`--fixture`、`--descriptions`）与一个工作区骨架 `evals/workspace/`。description 改动只针对 train 失败点。

**Tech Stack:** Node.js 24 `node:test`、宿主 `claude` CLI（参考 adapter）、Anthropic Messages 兼容端点、`qwen3.8-flash` 为驱动模型。

## Global Constraints

- 两族不得混用；触发判据是宿主激活事件。
- `split_sha256` 钉住的划分不得与 description 改动同批。
- 只有 train 失败可以指导修改；validation 只用于挑版本，不得用来调参。
- 声明的数字必须来自真实运行；作废的运行要就地标注为作废，不得混进速率。
- `results/v0.6..v0.9-routing-summary.json` 只读。
- `npm test` 限定 `tests/**/*.test.mjs`。

## File Map

| 文件 | 动作 |
|---|---|
| `scripts/run-trigger-eval.mjs` | 改：stream-json 检测、激活列表、null-target 判定修正、`--concurrency`、失败诊断、清理容错、`--fixture`、`--descriptions` |
| `scripts/run-quality-eval.mjs` | 改：agent 臂 `--dangerously-skip-permissions`、`buildTranscript` 时序日志、`skill_activations` 记录 |
| `evals/workspace/**` | 新建：工作区对照骨架（小 Node 项目 + 故意失败的测试 + `.gitignore`） |
| `evals/candidates/train-run1-descriptions.json` | 新建：候选 A 的 7 条 description，用于 validation 对比 |
| `skills/{zhanggui-requesting-code-review,zhanggui-verification-before-completion,zhanggui-finishing-a-development-branch,zhanggui-using-git-worktrees,zhanggui-dispatching-parallel-agents,setup-collaboration-files,decision-notes}/SKILL.md` | 改：description |
| `evals/catalog-current.json` | 改：快照 digest 同步、`changes_since_supersede` 记录逐技能改动与失败用例、新增 `trigger_family` |
| `evals/README.md` | 改：当前状态换成真实数字与测量条件 |
| `evals/results/*.json` | 新建：两族运行记录 |

## Tasks

- [x] **T1 校准 adapter**
  - `--dry-run` 通过；用 `--filter '^tdd-pos-0[1-3]$'` 发现 claude adapter 恒判 fail：`--output-format json` 的输出里没有 `messages`。
  - 改用 stream-json 后同批 3/3 PASS；再用 8 条混合（3 正 / 3 null / 2 debug）确认正例加载、负例干净、root 与 leaf 可区分。

- [x] **T2 修触发族评分与吞吐**（缺陷 2/3/4/5/6）
  - 激活列表 + 成员判定；null-target 通过条件按语料 `method` 原文重写；`--concurrency`；失败原因落盘；清理不中断。

- [x] **T3 找可用的宿主与模型**
  - 用户 `~/.claude/settings.json` 指向的中继不可达（TLS），改用本机 Anthropic 兼容端点。
  - 换模型三次：`deepseek-flash`（0.656，模型是瓶颈）、`deepseek-v4-pro`（31/32 超时）、`gpt-5.5`（端点无渠道）、第三方端点 `qwen3.8-flash`（81/279 因 429 作废）。
  - 定案 `qwen3.8-flash` + 本机端点 + 并发 8。

- [x] **T4 工作区对照**（负结果，`--fixture`）
  - 建 `evals/workspace/`；同批失败 query 在真实 git 工作区重跑。
  - 已完成的 14 条全部仍失败；transcript 显示模型认真做了活但从未考虑 catalog。假设否定，`--fixture` 降为可选对照。

- [x] **T5 训练集基线**
  - `--split train --runs 3 --concurrency 8`：85/93 = 0.914，274/279 次调用成功。

- [x] **T6 按 train 失败改 description**
  - 七个技能，逐条对着失败 query 与混淆数据改；改完 `npm run check` 68/68 + `Validated 11 strict Agent Skills.`。

- [x] **T7 训练集复跑**
  - 86/93 = 0.925。

- [x] **T8 按 validation 挑版本**（缺陷 7）
  - 加 `--descriptions`；两个候选各跑 51×3。
  - 结果打平（48/51 对 48/51）；逐条 diff 显示 2 升 2 降，其中 `req-pos-08` 被内置 `code-review` 抢走的两次在候选 B 全部收回。采用候选 B，并在 spec 里写清"打平不等于胜出"。

- [x] **T9 质量族**（缺陷 8/9/10）
  - 首跑 delta=0，查 evidence 发现每次 Bash/Write 被权限拒绝 → 加 `--dangerously-skip-permissions`。
  - 二跑两臂都满分，仍 delta=0；加 `skill_activations` 发现激活正常，是判官只拿到 transcript 尾部 → 加 `buildTranscript`。
  - 三跑：debugging +0.333，tdd +0.167，两技能 with 臂 100%。

- [x] **T10 同步文档与快照**
  - `catalog-current.json` 快照 digest、`changes_since_supersede`、`trigger_family`；`evals/README.md` 当前状态；本文件的 plan + spec；`docs/history/README.md` 差异表。

- [x] **T11 改名后复测 + 一条标注修正**
  - `setup-collaboration-files` 改名后定向复测 13 条：recall 1.000，改名零代价。
  - `nm-ip-02` 发现 5/5 误触发；先做措辞微测（候选 v2，两臂各 5 次）→ **零区别**，候选作废；看 transcript 拿到机制（模型把它当参考文档读，答完没改文件）。
  - 结论是仪器缺陷而非描述缺陷：把 `nm-ip-02` 改标为 `setup-collaboration-files` 的正例，并把实测干净的 `nm-dn-03` 追加为其硬负例以保住 ≥6 道门。**不动 id、不动划分，`split_sha256` 不变**。
  - 改后复测 14 条 × 3 次：train 10/10、validation 4/4、recall 1.000、precision 0.968。

- [x] **T12 验证**
  - `npm run check`；`bash scripts/deploy-skills.sh --target agents --dry-run`。

## Verification

```bash
npm run check
bash scripts/deploy-skills.sh --target agents --dry-run
```

期望：68 tests / 68 pass / 0 fail；`Validated 11 strict Agent Skills.`；部署 dry-run 列出 11 个 skills 且无意外差异。

## 未覆盖

- validation 打平，版本选择只有一条定向修复被真正验证。
- 其余九个技能仍无质量语料，delta 不存在。
- `--fixture` 对照只跑到 14/32 就被中止（因当时未修的清理 EPERM），未补完。
- `catalog-current.json` 保持 `pending-reevaluation`；未为让 digest 门变绿而改判官 harness 的 `measured` 分支。
