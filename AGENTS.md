# Zhanggui skills 项目规则

本仓库的产物是 skills 本身，不是应用代码。

## 单一真值源

`skills/` 是唯一真值源。以下目录全部是**生成产物**，不在其中修改规则：

- `~/.claude/skills/`、`~/.codex/skills/`、`~/.agents/skills/`（宿主运行目录）
- 仓库内 `.claude/`、`.codex/`、`.pi/`（本机部署快照，已 gitignore）

改规则改 `skills/`，再用 `scripts/deploy-skills.sh` 或宿主插件安装同步出去。

`.agents/skills/` 是例外：那里放开发本仓库用的第三方技能（vendored，与上游逐字节一致），不是交付物，也不得修改——改了就无法直接更新。详见 `.agents/skills/README.md`。

## 仓库结构

仓库根既是创作项目，也是分发单元（`.claude-plugin/plugin.json` + `.codex-plugin/plugin.json` 的 skills root 指向 `./skills/`）：

```text
skills/          # 唯一真值源，每个技能一个顶层目录
commands/        # 宿主 slash 入口薄壳，只转发到技能，不复述规则
scripts/         # validate / deploy
tests/           # 路由与契约断言
evals/           # 触发数据集与运行记录；当前测量现状看 `evals/README.md`
docs/            # 当前设计论证；`docs/history/` 是已完成变更的快照，不是当前规则
.agents/skills/  # vendored 开发工具技能，不参与交付
```

技能只放在 `skills/` 下，不在仓库根平铺；新增技能自动进入校验与部署，无需改脚本里的名单。

## 目录约定

按 Agent Skills 规范组织每个技能目录：

```text
<skill-name>/
├── SKILL.md          # 必需；frontmatter 只用规范字段：name / description / license（根额外用 compatibility）
├── references/       # 按需加载的文档
├── scripts/          # 可执行脚本
└── assets/           # 输出用模板、图标
```

不要把参考文档或脚本平铺在技能根目录，也不要把变更说明、集成记录一类的过程文档放进技能目录——那些进 `docs/`。

`name` 必须等于目录名；`SKILL.md` 保持在 500 行 / 5000 token 以内，超出就按职责拆到 `references/` 并在正文里写清何时加载哪个文件（“看 `references/` 里的细节”这种写法无效）。

## description 写法

description 是唯一的触发面：启动时宿主只注入 `name` + `description`。按以下约束写：

- 以 `Use when ` 开头，第三人称，单行（不用 `>-` 折叠块，否则快照校验的单行正则只能抳到标记）。
- 只写触发条件，不概述步骤或工作流——概述了模型会照 description 拄，不再读正文。
- 用用户真会说的具体症状和关键词（错误信息、现象、工具名），不用 `multi-deliverable` 这类内部术语。
- 不写行为指令（“开场先说……”），那属于正文。

例外：`zhanggui` 与八个 `zhanggui-*` 的 description 被 `evals/results/v0.8-catalog-pending.json` 的 digest 钉住。改它们必须同步那份快照，**并且在重跑 trigger eval 前不得引用任何命中率**。`v0.7-routing-summary.json` 里的速率属于旧 description 目录，是历史记录，不描述当前目录。重测时 catalog 里必须放入无关的第三方技能作为干扰项——v0.7 全程只开了 `--skills "zhanggui*"`，没测出竞争条件下的代价。

## 改动纪律

- 规则原文只在一处维护。README、`docs/` 和概念地图只做索引，不复述规则细节。
- 路由条件必须是可机械判定的谓词（如 `readiness ∈ {durable-plan, epic-plan}`），不写"高风险"这类需要模型自评的模糊条件——自评条件会被一路评成 false。
- 改路由或契约时同步 `tests/` 断言。新增条件要有对应测试，且必须验证过它在条件被改坏时真的会失败。
- 文档行数不作硬上限；不为凑数字删约束、示例或可读空白。
- 新建或大改技能先读 `.agents/skills/writing-skills`（上游 superpowers 的技能创作方法论：先用 subagent 压力场景拿 baseline 失败，再写技能，再验证合规）。

## 验证

```bash
npm run check      # node --test + validate-agent-skills.mjs
```

`node --test` 期望 54 tests / 54 pass / 0 fail；validator 期望末行 `Validated 10 strict Agent Skills.`。

改完 skills 后至少跑一次 `npm run check`，再跑 `./scripts/deploy-skills.sh --target <host> --dry-run` 确认部署差异符合预期。
