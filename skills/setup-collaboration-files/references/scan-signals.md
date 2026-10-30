# Init Project — 扫描清单

Step 2 的探测清单。目的不是把仓库读一遍，而是拿到判断真值源、结构边界、目录职责、验证方式所必需的信号。

## 顶层结构与职责

探测并按需记录：`apps/`、`packages/`、`services/`、`libs/`、`src/`、`config/`、`docs/`、`tests/`、`scripts/`，以及项目自己的等价目录。

同时提取：

- 核心模块或目录职责
- 关键入口文件或路径（`main` / `app` / `router` / `server` / `cli` / 核心 service）
- 分层边界或依赖方向（如 `api -> service -> engine -> infrastructure`、`app -> packages`、`web -> api`）
- 项目共享协作目录（如 `.codex/skills/`、`config/agents`、`config/workflows`）
- 已存在的子目录 `AGENTS.md`，以及它约束的作用域

## manifest 与构建文件

| 生态 | 候选文件 |
|---|---|
| Node / TS | `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`package-lock.json`、`yarn.lock`、`turbo.json`、`nx.json` |
| Python | `pyproject.toml`、`uv.lock`、`poetry.lock`、`requirements.txt`、`requirements-dev.txt`、`Pipfile` |
| Go / Rust | `go.mod`、`Cargo.toml` |
| JVM | `pom.xml`、`build.gradle`、`build.gradle.kts`、`settings.gradle`、`settings.gradle.kts` |
| Ruby / PHP | `Gemfile`、`composer.json` |
| 通用构建与运行 | `Makefile`、`Taskfile.yml`、`Taskfile.yaml`、`Justfile`、`justfile`、`Dockerfile`、`docker-compose.yml`、`docker-compose.yaml` |
| CI / 自动化 | `.github/workflows/*.yml`、`.github/workflows/*.yaml`、`.gitlab-ci.yml`、`.circleci/config.yml` |

从中提取：环境/语言/运行时、主要框架与依赖类别、标准验证命令、配置目录。

## 正式文档发现

高优先级显式候选，存在就优先读：

- `README.md`、`docs/README.md`
- `docs/architecture.md`
- `docs/specs/architecture.md`、`docs/specs/database-design.md`、`docs/specs/config-format.md`

没有固定命名时不要卡死在这些文件名上，继续找真实存在、语义明确的正式文档：

- 仓库有 `docs/README.md`、文档索引或导航页时，优先按导航页判断该读哪些
- `docs/specs/`、`docs/design/`、`docs/plans/`、`docs/adr/`、`docs/decisions/`、`docs/subsystems/`、`docs/cookbook/`、`docs/postmortem/` 存在时，只读最相关、最显眼的少量文件
- 文件名或标题明显包含下列关键词的也纳入候选：`architecture` / `arch`、`database` / `schema` / `data-model`、`config` / `settings`、`design`、`spec`、`plan` / `roadmap`、`adr` / `decision`
- 仓库根没有 `docs/` 时，检查根目录或其他明显正式文档目录下的 `README`、`ARCHITECTURE*`、`DESIGN*`、`SPEC*`、`PLAN*`、`ADR*`、`DECISION*` 一类真实文件

**上限纪律**：只读能帮助判断真值源、结构边界、目录职责、验证方式的少量高信号文档。不要为了"看起来全面"批量扫完整个 `docs/`。

## 协作与笔记现状

- `AGENTS.md`、`CLAUDE.md`、`tools.md`、`memory.md`
- `docs/AGENTS.md`
- `.agents/notes/AGENTS.md` 及其状态目录（`proposed/`、`implemented/`、`rejected/`、`archived/`）各自已有多少条目、条目是否与目录状态一致
- 是否存在非法产物：`.agents/notes/INDEX.md`、`notes/README.md` 之类的总索引（发现即列入总结，归一处理）
- 旧的 `memory/archive/`：只读当月文件；当月不存在时最多读最近一个归档作为格式与近期上下文参考，不批量加载整段历史
- 已存在的字数预算文件（如 `doc-budgets.manifest.json` 或类似的 CI 配置）

## 标准验证命令抽取

只能从仓库内**显式存在**的信号提取：

- manifest 中已声明的 script / task
- `Makefile` / `Taskfile*` / `Justfile` 的真实 target
- CI 配置中的真实校验命令
- `README`、`docs`、现有 `AGENTS.md` / `CLAUDE.md` / `tools.md` 中明确写出的验证命令

执行原则：

- 优先保留仓库里已有的原始命令写法，不擅自改写成另一套"更常见"的风格
- 仓库里没有明确验证命令时只能写 `[待补充]`；不能因为看到了某个生态文件就自行猜成 `npm test`、`pnpm lint`、`pytest`、`cargo test`
- `tools.md` 的"定向验证命令"同样只允许来自显式信号，不能从目录名或测试框架习惯反推
