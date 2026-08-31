# evals — 触发数据集与运行记录

## 文件

| 文件 | 性质 |
|---|---|
| `skill-triggering.json` | 122 条触发用例数据集（digest 被 `tests/skill-trigger-data.test.mjs` 钉住） |
| `catalog-current.json` | **当前** description 目录的快照 + digest 门 + 待重测状态。改 description 就改这里，历史 summary 不动 |
| `results/v0.8-routing-summary.json` | 历史测量。对**归一化后、未做本轮三处修订**的目录测得：122 cases × 3 runs × 2 arms，A/B 双 arm 同批判官，catalog 掺入 6 个无关第三方干扰项 |
| `results/v0.7-routing-summary.json` | 历史测量。对**旧** description 目录测得（无干扰项），不描述当前目录 |
| `results/v0.6-routing-summary.json` | 更早的历史测量 |

## 当前状态：待重测（v0.9）

当前目录相对 v0.8 被测目录改了三处 description（tdd 找回 test-first 触发词、finishing 把"已通过验证"前置、dispatching 把"有 subagent 能力"前置），针对的是 v0.8 里三个 **3/3 确定性**误路由用例。`catalog-current.json` 记录了改动明细与 digest；在重测出 v0.9 之前，**v0.8 的速率只描述它自己那份 catalog**。

## v0.8 观测记录（对归一化后、未做本轮修订的目录）

description 按社区规范归一为只写触发条件后，用 `skill-triggering.json` 的同一批 122 case × 3 run 重测，保持 v0.7 记录的 evaluator prompt 与 transport retry 策略不变，catalog 掺入 6 个无关第三方干扰项，并同批判官跑完对照组（v0.7 的旧 description 原文）以便看 delta。结果见 `results/v0.8-routing-summary.json`：

- 处理组：root 四项速率全部满足阈值（explicit/implicit/root-first-conflict = 1.0，root_false_positive = 0.0）；leaf 正例 tdd 0.833、requesting 0.944、worktrees 0.889，其余 1.0；负例误触发 worktrees 0.111 / dispatching 0.222 / finishing 0.167。
- 对照 arm（旧 description 原文）：root 同样全部达标；leaf 正例 debugging/verification/requesting 0.944，其余 1.0；负例误触发 worktrees 0.056 / dispatching 0.111 / finishing 0。
- 相比对照的退化点记录在 summary 的 `failures`，run 级明细在 `failure_evidence`。
- transport 错误全部按 policy 重试处理完毕，0 残余，全部 732 slots 有效。

读这份成绩单时要带上三条限定（否则会得出"归一化单向掉速"的错误结论）：

1. **净账不是单向的**：归一化同时把 debugging、verification 正例从 0.944 抬到 1.0。按 slot 计，处理组错 15/288、对照组错 6/288。
2. **只有 3 个用例是可复现信号**：`tdd-pos-02`、`dispatching-neg-05`、`finishing-neg-01` 是 3/3 全错，其余都是单次翻转，与对照组的噪音底噪同量级；`dispatching-neg-02` 处理组 1/3、对照组 2/3，处理组反而更好。
3. **分辨率不足**：3 runs 的粒度是 1/18 ≈ 0.056，单 slot 差异无法与噪音区分。下一轮应把 `runs_per_case` 提到 ≥5 或改多判官投票。

另外，`finishing-neg-01`、`dispatching-neg-05` 这两个误路由在运行时已被正文兜住（finishing 正文强制新鲜验证证据、缺证据转 `zhanggui-verification-before-completion`；dispatching 正文禁止无证据宣称完成、禁止重叠写并行），代价是多读一个 SKILL.md 后自我纠正，不是行为错误。

## 重测要求（供未来版本沿用）

1. 用 `skill-triggering.json` 的同一批 122 case × 3 run，保持 `results/v0.7-routing-summary.json` 里记录的 evaluator prompt 与 transport retry 策略不变，这样新旧可比。
2. **catalog 必须掺入与 Zhanggui 无关的第三方技能作为干扰项。** v0.7 全程只开 `--skills "zhanggui*"`，catalog 里只有自己九个，测不出与其他技能竞争时的表现——旧 description 里的互斥条款正是在这种竞争场合吃亏。
3. 方法论按 `.agents/skills/writing-skills`：先在改动前拿 baseline，再对比改动后。
4. 判官只读 `name` + `description`（见 summary 的 `routing_evaluation.system_prompt`），该约束对 description 的写法要求看 `AGENTS.md` 的 "description 写法"。
5. 出结果后新建 `results/v0.9-routing-summary.json`（含 rates、leaf baselines、catalog 快照、distractors、baseline 对照 arm、failures + run 级 failure_evidence），把 `catalog-current.json` 的 `supersedes` 指向它；已发布的 v0.7/v0.8 记录只读，digest 门始终只钉 `catalog-current.json`。
