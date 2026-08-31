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
| 九个技能 | 十个（新增 `init-project`） |
| description 里带 `Do not use for...` / `defer to the zhanggui root...` | 已移除；description 只写触发条件，仲裁与边界规则移入正文 |
| v0.7 routing 速率 | 对旧 description 目录测得，见 `../../evals/README.md` |
