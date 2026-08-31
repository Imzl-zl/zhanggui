# evals — 触发数据集与运行记录

## 文件

| 文件 | 性质 |
|---|---|
| `skill-triggering.json` | 122 条触发用例数据集（digest 被 `tests/skill-trigger-data.test.mjs` 钉住） |
| `results/v0.8-catalog-pending.json` | **当前**目录的 description 快照；`status: pending-reevaluation`，还没有测量数据 |
| `results/v0.7-routing-summary.json` | 历史测量。对**旧** description 目录测得，不描述当前目录 |
| `results/v0.6-routing-summary.json` | 更早的历史测量 |

## 当前状态：未测量

description 已按社区规范归一为只写触发条件（移除了 `Do not use for...` / `defer to the zhanggui root...` 仲裁条款与行为指令），所以 v0.7 那批速率不再适用于当前目录。在重跑之前不要引用任何命中率——包括 README 里标注为"已被取代"的那几条。

## 重测要求

1. 用 `skill-triggering.json` 的同一批 122 case × 3 run，保持 `results/v0.7-routing-summary.json` 里记录的 evaluator prompt 与 transport retry 策略不变，这样新旧可比。
2. **catalog 里必须掺入与 Zhanggui 无关的第三方技能作为干扰项。** v0.7 全程只开 `--skills "zhanggui*"`，catalog 里只有自己九个，测不出与其他技能竞争时的表现——旧 description 里的互斥条款正是在这种竞争场合吃亏。
3. 方法论按 `.agents/skills/writing-skills`：先在改动前拿 baseline，再对比改动后。
4. 出结果后把 `results/v0.8-catalog-pending.json` 换成正式的 `results/v0.8-routing-summary.json`（含 rates、leaf baselines、catalog 快照），并同步 `tests/skill-trigger-data.test.mjs` 的断言。
