# 两族评测首次实跑设计

**状态：** 已实施（两族均已运行并留下记录）
**日期：** 2026-09-16
**目标版本：** v0.9.0（未发版，改动仍在工作树）
**前序：** [`2026-09-16-community-eval-methodology-design.md`](2026-09-16-community-eval-methodology-design.md)
**适用范围：** `scripts/run-trigger-eval.mjs`、`scripts/run-quality-eval.mjs`、`evals/triggers/`、`evals/workspace/`、`evals/candidates/`、`evals/results/`、`evals/catalog-current.json`、`evals/README.md`、五个被评测技能的 `SKILL.md`

## 1. 背景

上一批交付了两族 runner 与语料，**一族都没跑过**，因此当时目录里没有任何有效数字，且两个非 claude adapter 未校准。本批的目标是把两族真跑一遍、拿到真实数字、据此改 description，并按 validation 通过率挑版本。

结果：**十一个 harness 缺陷**在第一次真跑中暴露出来（触发族 7 个、质量族 4 个）。它们全都属于"不跑就看不见"的类型——静态审读 runner 不会发现 `--output-format json` 根本没有 transcript，也不会发现默认权限模式把两臂一起压成静态分析。

## 2. 发现的缺陷与修法

### 2.1 触发族

| # | 缺陷 | 后果 | 修法 |
|---|---|---|---|
| 1 | `claude` adapter 读 `--output-format json` 的 `payload.messages`，而该输出**不含 `messages` 字段** | 每条 query 都会判"没加载任何技能"，全表红 | 改用 `--output-format stream-json --verbose`，扫 `assistant` 事件的 `tool_use(name=Skill).input.skill`；单文档形态保留为回退 |
| 2 | adapter 只返回**第一个**激活的技能 | 一次请求可以先加载 `zhanggui` 再加载 leaf，第二个加载对评分不可见，会被记成"什么都没加载" | `loaded` 由标量改为**有序激活列表**，按成员判定 tp/fp；precision 因此能看见"顺带加载了别的技能" |
| 3 | null-target 的通过条件写成 `cleanRate < threshold` | 与语料 `method` 原文（should-not-trigger 要求 trigger rate < threshold）相反，"该不触发却触发了"反而判通过 | 按语料口径重写：should-trigger 用 match rate，should-not-trigger 用其补数 |
| 4 | 串行 spawn，432 次调用要数小时 | 迭代成本高到无法按 ≤5 次迭代的纪律走 | 加 `--concurrency`（默认 4），`mapWithConcurrency` 保持记录顺序 |
| 5 | 失败调用只在超时时记录 error | 81 次 exit=1 的失败原因全部丢失，只能看到"成功率 185/279"这种无法解释的数字 | 任何失败调用都记录 message + stderr（截断到 4000 字符） |
| 6 | `finally` 里的 `rmSync` 在 Windows 文件锁下抛 EPERM | 一次清理失败**炸掉整轮 96 次调用的运行**，报告不写 | 清理改为带 `maxRetries` 的 best-effort，失败不中断 |
| 7 | 无法在不手改 `skills/` 的前提下比较两个候选 catalog | "按 validation 通过率挑版本"只能靠来回改文件，比较随时会变成不是比较 | 新增 `--descriptions <file>` 覆盖映射；只作用于本次运行，覆盖文件 sha256 记进报告 |

另加 `--fixture <dir>`：先给宿主铺一个真实 git 工作区，再跑同一批 query。见 §4。

### 2.2 质量族

| # | 缺陷 | 后果 | 修法 |
|---|---|---|---|
| 8 | agent 臂按默认权限模式启动 | 每次 Bash 与 Write 都被拒，两臂都退化成读代码 + 手推，**delta 恒为 0 且测的不是技能** | agent 臂加 `--dangerously-skip-permissions`；判官臂不给（判官不需要工具） |
| 9 | 判官只收到 `result.stdout` 的**最后 8000 字符**（stream-json 原文） | red 阶段在早期，"先红后绿"类断言在两臂同时判 FAIL——恰好是 workflow 技能存在的理由 | 新增 `buildTranscript`：把事件流压成 `TOOL / RESULT / TEXT` 时序日志，超长时保留头尾 |
| 10 | 报告不记录技能是否真的加载 | with_skill 臂若没激活技能，delta=0 无法解释 | agent 臂记 `skill_activations` |
| 11 | `ADAPTERS.omp` 是个没有参数列表的空壳（改动前也跑不动，只会拉起交互式会话） | 拆出 `agentArgs` / `judgeArgs` 后它会以 TypeError 形式躺在这里，读起来像受支持的 host | 移除；`--host` 现在只接受 `claude` 并给出清晰报错 |

## 3. 宿主与模型的测量条件

触发率是 **(catalog, host, model)** 的属性，不是 catalog 单独的性质。本批记录的条件：

- host：`claude` CLI（参考 adapter），调用形态 `claude -p <query> --output-format stream-json --verbose`
- 端点：本机 `http://127.0.0.1:23333`（Anthropic Messages 兼容网关），`ANTHROPIC_MODEL` 决定实际模型
- 驱动模型：`qwen3.8-flash`（经该端点）
- 并发 8（触发族）；质量族串行

**同一语料同一 catalog 换模型就换结论**，这是本批最贵的发现：

| 驱动模型 | train 通过率 | 说明 |
|---|---|---|
| `deepseek-flash`（本机端点） | 61/93 = 0.656 | 大量 query 稳定不激活任何技能，不是描述冲突 |
| `deepseek-v4-pro` | 无有效数据 | 32 条里 31 条在 420 s 超时 |
| `gpt-5.5`（第三方端点） | 无有效数据 | 端点报 `模型无可用渠道` |
| `qwen3.8-flash`（第三方端点，并发 10） | 0.892，**作废** | 81/279 次调用 HTTP 429；该端点限 11 请求/分钟。记录改为 `results/triggers-train-DISCARDED-ratelimited.json`，不得引用其速率 |
| `qwen3.8-flash`（本机端点，并发 8） | 0.914（改前）/ 0.925（改后） | 本批采用 |

宿主自带的技能（`code-review`、`verify`、`debug`、`simplify` 等）与 catalog 同场竞争，且**无法关闭**：把 `USERPROFILE` / `HOME` / `CLAUDE_CONFIG_DIR` 全部指向干净临时目录后，`system/init` 的 `skills` 里仍有它们。它们不计入 catalog 加载，但确实抢流量——`req-pos-08` 就是被内置 `code-review` 拿走的。

## 4. 工作区对照（负结果）

语料里大量 query 指称具体物件（"这个 diff"、"这个单测昨天还好好的"），而 runner 只铺 `.claude/skills`，工作区里没有代码、没有 git、没有失败测试。假设是：宿主找不到指称对象于是不激活技能。

做法：新增 `evals/workspace/`（小 Node 项目：cart/pricing/api/views、一个故意失败的测试、一次未提交改动、`.agents/notes/` 已有笔记），加 `--fixture` 把它铺进工作区，同一批失败 query 再跑一次。

结果**否定了这个假设**：

- 4 条抽查里只有 1 条恢复（`wt-pos-03`）。
- 32 条失败 query × 3 次的完整对照，跑到第 14 条时因 §2.1 缺陷 6 中止；已完成的 14 条**全部仍然失败**，其中包括有真实失败测试的 `dbg-pos-01` 和有真实 diff 的 `req-pos-01`。
- 直接看 transcript 确认原因：模型会认真 `git diff`、读改动文件、跑测试、给出**结构完整**的代码审查，然后**从头到尾没有考虑过 catalog**。这是宿主行为，不是上下文缺失。

因此 `--fixture` 保留为**可选对照**，不进默认配置；默认配置仍是"只铺 catalog"。这一条也解释了为什么改 description 能起作用却是慢杠杆：只有当模型决定"这个任务需要一套流程"时，description 才参与竞争。

## 5. 数字与版本选择

### 5.1 触发族

改动依据只有 train 失败（8 条）：

| 技能 | train recall/precision 改前 → 改后 | 诊断 |
|---|---|---|
| `zhanggui-requesting-code-review` | 0.556/1.000 → 0.833/0.882 | 只有点明"独立 reviewer / 按严重程度分级"才触发；平铺直叙的"review 一下这个 diff"、"帮我审查这三个文件"、"先做一次代码审查"不触发 |
| `zhanggui-verification-before-completion` | 0.833/0.714 → 0.778/0.875 | 与 `finishing-a-development-branch` 重叠：在"测试过了，你决定下是合还是开 PR"这类**已验证、只剩落地决定**的请求上误触发 6 次 |
| `zhanggui-using-git-worktrees` | 0.810/1.000 → 0.857/0.947 | 触发子句只覆盖"还需要隔离检出"的工作，"建完 worktree 后面还要清理掉"不触发 |
| `zhanggui-dispatching-parallel-agents` | 0.857/1.000 → 0.857/1.000 | "并行派发时注意别让两个 agent 改同一个文件"：派发已成定局、只剩写范围要定，触发率 1/3 |
| `zhanggui-finishing-a-development-branch` | 1.000/1.000 → 0.952/1.000 | 自身无失败，是上面 6 次误触发的**落点**；只改措辞（"has already passed verification" → "whose verification is already settled"），把 "verification" 这个词的广告效应收回来 |
| `setup-collaboration-files` | 1.000/0.810 → 1.000/0.857 | "这几个规则文件应该放哪"是提问不是任务，3/3 误触发 |
| `decision-notes` | 1.000/0.913 → 1.000/1.000 | "记录一下今天的进度"是流水不是决策，2/3 误触发 |

其余四个技能（`zhanggui`、`receiving-code-review`、`systematic-debugging`、`test-driven-development`）未改 description。总体 85/93 = 0.914 → 86/93 = 0.925，null-target 清洁率 0.879 → 0.877。

**版本选择按 validation 通过率**，两个候选各跑一次 51×3：

| | train | validation |
|---|---|---|
| 候选 A（改前 catalog，`evals/candidates/train-run1-descriptions.json`） | 0.914 | **48/51 = 0.941** |
| 候选 B（当前工作树） | 0.925 | **48/51 = 0.941** |

**打平。** 逐条 diff 显示 2 条 PASS→FAIL、2 条 FAIL→PASS：

- `req-pos-08` FAIL→PASS：候选 A 三次里有两次被宿主内置 `code-review` 拿走，候选 B 三次全部命中 `zhanggui-requesting-code-review`。这是**针对已诊断冲突的定向修复，且在两个划分上同号**（train +0.277、validation +0.250）。
- `rec-pos-10` FAIL→PASS。
- `zg-pos-06` PASS→FAIL：`zhanggui` 的 description **没改过**，属运行间方差。
- `wt-pos-08` PASS→FAIL。

判定：**采用候选 B**。依据是总体不劣（打平）、定向修复在两个划分上同号且机制可解释；其余逐技能差异在 train / validation 之间**反向变号**（worktrees 0.810→0.857 却 1.000→0.778；verification precision 0.714→0.875 却 0.846→0.750），按定义属于 n=2~3 次重复的方差，不足以支持"改坏了"。**本批没有把 validation 打平解释成"胜出"**：真正被验证的只有 requesting-code-review 一条。

### 5.1.1 一次停下来的尝试（`nm-ip-02`）

`setup-collaboration-files` 的改名后复测发现 `nm-ip-02`「这几个规则文件应该放哪」**5/5 误触发**，于是按方法论先做措辞微测而不是全量重跑：

- 候选 v2 把能力句改成以动作为主（"writing the root AGENTS.md and CLAUDE.md..."），并把前置条件换成"**those files themselves are the deliverable**"。
- 两臂各 5 次：**完全无区别**——`nm-ip-02` 两臂都 5/5 触发，`ip-pos-03`、`ip-pos-05` 两臂都 5/5 命中。候选作废（`evals/candidates/setup-collaboration-files-v2.json`、`results/probe-setupfiles-arm-{a,b}.json`）。
- 看 transcript 拿到机制：模型加载它时带的参数是"说明规则文件应放置的位置"，把它当**参考文档**读，答完问题后**没改任何文件**。任何把"文件布局"写成该技能主题的描述，都会让这个技能成为布局问题的参考源——所以两种措辞同号失败。

结论：**措辞在这里已经用尽，剩下的是语料问题**，不是 description 问题。

一开始把选择框成了"改标注 vs 保住可比性"二选一，那是错的：卡点其实是两道独立的门，第二道可以绕开。

- 把 `nm-ip-02` 改成正例 → 该技能硬负例从 6 降到 5，撞"每技能 ≥6 条硬负例"这道门。
- 补一条**新造**负例 → 新 id → `split_sha256` 变 → 四份速率记录不再可比。
- **绕开的路**：不新造 query，把**已有**负例追加进该技能的 `near_miss_for`。语料对这个字段的定义本来就是"共享关键词或表层词汇"，是设计声明而不是"必须被观测到竞争过"；`id` 与 `split` 都不动，所以 `split_sha256` 原样不动。

最终处理（见 `catalog-current.json` 的 `corpus_change` 与语料文件自身的 `labelling_notes`）：

1. `nm-ip-02` 标注从 `null` 改为 `setup-collaboration-files`，并从该技能的 `near_miss_for` 中移出。
2. `nm-dn-03`（"把这份需求文档存下来"）追加为同技能的硬负例，**先实测 5/5 干净再写入**（不凭猜）。落地后硬负例回到 6，门过。
3. `split_sha256` 仍为 `c980836bdcc1`，**四份速率记录继续可比**。

判定理由不是"这样数字好看"，而是它属于**仪器缺陷**：这条标注断言"关于协作文件放哪的提问必须什么都不加载"，但这个技能自己的目标表就是该问题的答案；用一条任何描述都够不着的歧义标注，等于让这个技能永远背着一个修不掉的失败信号。反方论据（技能一旦加载就会不问自走 Step 1–12，换一个宿主可能真的开始建/改文件，而这比观测到的那次只是模型自律）已写进语料文件的 `counter_argument`，回滚是两行编辑。

改后复测（`results/triggers-recheck-renamed-skill.json`，14 条 × 3 次，39 次成功）：train 10/10、validation 4/4、recall 1.000、precision 0.968（唯一 fp 是 `nm-ip-01` 三次里触发一次，属既有抖动）。

### 5.2 质量族

| 技能 | with_skill | without_skill | delta | 激活确认 |
|---|---|---|---|---|
| `zhanggui-systematic-debugging` | 1.000 | 0.667 | **+0.333** | 两例 with 臂均加载，without 臂均未加载 |
| `zhanggui-test-driven-development` | 1.000 | 0.833 | **+0.167** | 同上 |

without 臂的失分点很集中：debugging 的 `buggy-cart-explain-without-editing` 丢掉"根因说得够清楚"和"证据来自实际运行"两条；tdd 的 `fresh-cart-casual-phrasing` 丢掉"改动范围只限新规则"（无技能臂把既有的满减逻辑重构成通用规则表）。

**方差警告：** 每个技能只有 2 个用例、每个臂只跑 1 次。同一配置在本批内换过三次（json → stream-json → 修好 transcript），delta 依次为 0.000 / +0.267 / +0.333（debugging）与 0.000 / +0.067 / +0.167（tdd）。前两组数字**不可引用**——harness 不同、且前两组的分母是被截断的 transcript。只有最后一组来自证据完整的配置。要判断这两个技能是否稳定胜出，需要加用例和重复次数。

## 6. 已知代价与未覆盖

- **版本选择未被 validation 分辨。** 两个候选打平，真正被验证的只有一条定向修复。把"采用候选 B"读成"候选 B 更好"是过度解读。
- **只有 2/11 个技能有质量语料。** 其余九个的 delta 不存在，不能说它们挣到了 token。
- **触发率不可跨模型引用。** §3 的表就是反例：同一语料的 train 通过率在 0.656 与 0.925 之间摆动。
- **`catalog-current.json` 仍为 `pending-reevaluation`。** `tests/skill-trigger-data.test.mjs` 的 `measured` 分支要求 `measured_by` 指向一份 `version: '0.9'` 的判官 harness summary；触发族产出的是 run 记录，不是那种 summary。本批把新记录写进 `trigger_family.records` 并把 `status` 留在 `pending-reevaluation`，没有为了变绿去改那份门。
- **宿主自带技能的竞争无法关闭**，因此本批速率是"在一个自带 `code-review` / `verify` / `debug` 的宿主里"的速率。
- **判官是非 Claude 模型**，判官身份哈希为 `ce24d4a9bd7b3be0`；两族数字都带这个前提。
- 未接 CI；未把 `--fixture` 对照补完；未为其余九个技能写质量语料。
