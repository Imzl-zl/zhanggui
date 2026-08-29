# Zhanggui skills 项目规则

本仓库的产物是 skills 本身，不是应用代码。

## 单一真值源

`zhanggui/skills/` 是唯一真值源。以下目录全部是**生成产物**，不在其中修改规则：

- `~/.claude/skills/`、`~/.codex/skills/`、`~/.agents/skills/`（宿主运行目录）
- 仓库内 `.claude/skills/`、`.codex/skills/`、`.pi/skills/`（本机部署快照）

改规则改 `zhanggui/skills/`，再用 `zhanggui/scripts/deploy-skills.sh` 或宿主插件安装同步出去。

## 目录约定

按 Agent Skills 规范组织每个技能目录：

```text
<skill-name>/
├── SKILL.md          # 必需；frontmatter 只用 name / description（根额外允许 compatibility）
├── references/       # 按需加载的文档
├── scripts/          # 可执行脚本
└── assets/           # 输出用模板、图标
```

不要把参考文档或脚本平铺在技能根目录，也不要把变更说明、集成记录一类的过程文档放进技能目录——那些进 `zhanggui/docs/`。

## 改动纪律

- 规则原文只在一处维护。README、`docs/` 和概念地图只做索引，不复述规则细节。
- 路由条件必须是可机械判定的谓词（如 `readiness ∈ {durable-plan, epic-plan}`），不写"高风险"这类需要模型自评的模糊条件——自评条件会被一路评成 false。
- 改路由或契约时同步 `zhanggui/tests/` 断言。新增条件要有对应测试，且必须验证过它在条件被改坏时真的会失败。
- 文档行数不作硬上限；不为凑数字删约束、示例或可读空白。

## 验证

```bash
cd zhanggui
npm run check      # node --test + validate-agent-skills.mjs
```

`node --test` 期望 50 tests / 50 pass / 0 fail；validator 期望末行 `Validated 9 strict Agent Skills.`。

改完 skills 后至少跑一次 `npm run check`，再跑 `./scripts/deploy-skills.sh --target <host> --dry-run` 确认部署差异符合预期。
