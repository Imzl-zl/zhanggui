# .agents/skills — 第三方开发工具技能（vendored）

这里放**开发本仓库时用的**第三方技能，不是本仓库的交付物。

交付物只在 `../../skills/`：plugin manifest、`scripts/validate-agent-skills.mjs`、`scripts/deploy-skills.sh` 全部只看那里，所以这里的内容不会被当成 Zhanggui 的技能校验、部署或发布。

## writing-skills

| 项 | 值 |
|---|---|
| 上游 | https://github.com/obra/superpowers `skills/writing-skills` |
| 版本 | commit `b36e0829c6d0140e93cfef2ca599b1b07d4a7797`（v6.3.0） |
| 许可 | MIT，见 `LICENSE-superpowers.txt` |
| 改动 | 无。与上游逐字节一致，便于直接更新 |

社区最成熟的"怎么写技能"方法论：把写技能当成对流程文档做 TDD（先用 subagent 压力场景看到 agent 在没有技能时怎么失败，再写技能，再看它是否合规），外加 Skill Discovery Optimization（description、命名、关键词覆盖、token 预算）。本仓库正是创作技能的项目，所以它是这里唯一装着的开发工具。

### 上游引用在本仓库解析不到的部分

它是 superpowers collection 的一员，正文引用了没有一起装的 sibling。遇到这些引用时按下表替换，不要去改上游文件（改了就没法直接更新）：

| 上游引用 | 本仓库对应 |
|---|---|
| `superpowers:test-driven-development` | `zhanggui-test-driven-development` |
| `superpowers:systematic-debugging` | `zhanggui-systematic-debugging` |
| `../using-superpowers/references/codex-tools.md`、`gemini-tools.md` | 无对应文件；宿主工具映射看各宿主自己的文档 |

`render-graphs.js` 需要本机装 graphviz（`dot`）才能渲染流程图；不渲染也能正常使用技能正文。

### 更新与生效

```bash
# 更新到上游最新
git clone --depth 1 https://github.com/obra/superpowers /tmp/sp
cp -R /tmp/sp/skills/writing-skills .agents/skills/writing-skills   # 覆盖
git -C /tmp/sp rev-parse HEAD                                        # 把新 SHA 记回本文件

# 让本机宿主发现（.pi/ 与 .claude/ 是 gitignored 生成产物）
cp -R .agents/skills/writing-skills .pi/skills/writing-skills
cp -R .agents/skills/writing-skills .claude/skills/writing-skills
```
