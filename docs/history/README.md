# docs/history — 历史记录，不是当前规则

这里是已完成变更的计划与设计快照，按当时的事实原样保留：路径、版本号、技能数量、description 原文都是**那一次变更发生时**的状态，不随后续演进更新。

读它们是为了追溯"当时为什么这么决定"。当前规则只看这三处：

- 技能契约：`skills/*/SKILL.md`（及内部 `STAGE.md`）
- 当前架构与设计论证：[`../skill-fusion-design.md`](../skill-fusion-design.md)
- 仓库开发纪律：[`../../AGENTS.md`](../../AGENTS.md)

已知与当前状态的差异（不在这些文件里改）：

| 历史文件里的写法 | 当前状态 |
|---|---|
| 路径 `zhanggui/skills/`、`zhanggui/tests/` | 仓库根上提后为 `skills/`、`tests/` |
| 九个技能 | 十一个（新增 `setup-collaboration-files`、`decision-notes`） |
| `setup-collaboration-files` 产出 `memory/archive/YYYY-MM.md` 月度流水，且归一要求删除失效旧规则 | 月度流水已退役（旧文件保留不动、不再追加）；已发生的决定不得删除，只标注被谁取代后移入 `archived/` |
| description 里带 `Do not use for...` / `defer to the zhanggui root...` | 已移除；仲裁与边界规则移入正文 |
| description 以 `Use when` 开头、只写触发条件 | 已改为**能力在前 + `Use when` 触发子句**（规范要求同时说清“做什么”与“何时用”）；九个被钉住的 description 因此进入 `pending-reevaluation`，见 `../../evals/catalog-current.json` |
| 自定 description 上限 500 字符 | 已改为 600（规范上限 1024 不变） |
| v0.7 / v0.8 / v0.9 routing 速率 | 旧判官 harness（只读 name + description 挑一个）测得，属描述冲突检查而**非**触发测量；当前目录为 `pending-reevaluation`，不得用任何一版历史速率描述它。历史结论索引见 `../../evals/README.md` |
| 验证命令写 `node --test`，`node --test tests/skill-trigger-data.test.mjs` 作为 Trigger eval | 已改为 `node --test "tests/**/*.test.mjs"`；`skills/*/evals/files/` 下的质量夹具是故意会失败的，裸跑会把它们招进仓库测试。旧 harness 降级为"历史：非发布门槛" |
| “评测”= 一批判官用例 | 已分为两族：触发质量（真 agent 观测激活，`evals/triggers/`）与输出质量（with/without 对照看 delta，`skills/*/evals/`）。两族均已首次实跑，数字见 [`../../evals/README.md`](../../evals/README.md) |
| 两族语料就位但尚未运行 | 已运行并留下记录：触发族 train/validation 两份候选目录各 93×3 与 51×3，质量族两个技能各 2 例对照；逐条改动与失败用例见 [`specs/2026-09-16-first-eval-runs-design.md`](specs/2026-09-16-first-eval-runs-design.md) |
| `claude` adapter 照抄上游示例读 `--output-format json` 的 `messages` | 当前 CLI 的该输出不含 `messages`，实测会**每条都判 fail**；已改为读 `stream-json --verbose` 的 Skill 工具调用，单文档形态作回退 |
| 触发 runner 串行 spawn，全量 432 次调用要数小时 | 已加 `--concurrency`（默认 4）；另加 `--fixture` 工作区对照与 `--descriptions` 候选目录覆盖 |
| 质量 runner 按默认权限模式启动 agent | 默认模式下 Bash/Write 全被拒，两臂都退化成静态分析、delta 恒为 0；agent 臂已改为 `--dangerously-skip-permissions`，判官臂不给 |
| 质量 runner 把 `result.stdout` 的尾部交给判官 | 尾部会截掉 red 阶段，使“先红后绿”类断言在两臂同时判 FAIL；已改为 `buildTranscript` 时序日志（超长保留头尾） |
| `omp` / `codex` adapter 未校准 | 仍为启发式、仍未校准；本批全部数字来自 `claude` 参考 adapter |
| 触发速率可跨模型引用 | 不可。同一语料同一 catalog 换驱动模型即变结论（实测 0.656 ↔ 0.925）；记录速率的报告必须同时记 `driving_model` |
| 技能名 `init-project` | 已改名 `setup-collaboration-files`：它一半的话是“把已有规则文件归一”，`init-` 只覆盖新建。语料里的 `expected_skill` 值同步改了，但 **query id 与 train/validation 划分未动**（`split_sha256` 不变）；已发布的运行记录保留了当时的旧名 |
| `CLAUDE.md` 仅在仓库已存在时改写为 `@AGENTS.md` | 已改为**始终生成**（不存在则创建，已存在则先备份再改写），因为宿主不一定读 `AGENTS.md`，`CLAUDE.md` 是 Claude Code 的固定入口 |
