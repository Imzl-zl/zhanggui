---
name: init-project
license: MIT
description: Use when a project needs its collaboration file system (AGENTS.md / CLAUDE.md, tools.md, memory.md, memory/archive/) initialized or normalized, including when the user asks to "init project", "set up AGENTS.md", "initialize collaboration files" or "normalize rules", and when work starts on an unfamiliar project that lacks structured collaboration files, whether greenfield or with existing rule files to unify.
---

# Init Project - 项目协作体系初始化

## 使用方式

- 直接调用 `init-project` skill
- 不需要参数
- 内部只处理两种情况：
  - 项目里还没有规则文件
  - 项目里已经有规则文件

## 目标

在项目根目录建立或归一以下协作文件体系：

- `AGENTS.md`：项目唯一 canonical 规则文件
- `CLAUDE.md`：仅在仓库里已存在时改写为兼容入口，默认不新建
- `tools.md`：稳定协作知识、常用命令、模式、坑点
- `memory.md`：当前状态快照 + 最近活跃窗口
- `memory/archive/YYYY-MM.md`：按月追加的重要协作历史

## 默认目标结构

- 默认目标始终是：`AGENTS.md` 作为唯一主规则文件
- `AGENTS.md` 采用"最小骨架 + 按仓库信号追加独立小节"的生成策略：
  - 最小骨架至少包含：
    - `0. 实施基线`
    - `1. 作用`
    - `2. Source of Truth`
    - `3. 架构与项目结构`
    - `4. Agent 协作文件规则`
    - `5. 验证、入口与关键路径`
    - `6. 项目特定规则`
    - `7. 维护原则`
  - 如果仓库已有足够强的规则/文档/代码信号，可额外拆出独立小节：
    - `架构基线`
    - `模块规则`
    - `分层依赖规则`
    - `shared/core 规则`
    - `workflow 特别规则`
    - `文档同步规则`
    - `禁止事项`
- `CLAUDE.md` 如果仓库里原本存在，则在备份后改写为 `@AGENTS.md`
- `tools.md` / `memory.md` / `memory/archive/YYYY-MM.md` 不是摆设；生成后的规则文件必须明确它们的读取时机和写入维护规则

## Workflow

### Step 1: Locate Project Root

优先执行：

```bash
git rev-parse --show-toplevel 2>/dev/null
```

- 成功：结果记为 `repo_root`
- 失败：提示当前目录不是 git 仓库，并询问是否把当前目录作为项目根继续
- 项目名使用：

```bash
basename "<repo_root>"
```

### Step 2: Read Current Context

#### 2a. Read existing collaboration and rule files

存在则读，不存在跳过：

- `<repo_root>/AGENTS.md`
- `<repo_root>/CLAUDE.md`
- `<repo_root>/tools.md`
- `<repo_root>/memory.md`
- `<repo_root>/memory/archive/[当月 YYYY-MM].md`
- `<repo_root>/README.md`
- `<repo_root>/docs/README.md`
- `<repo_root>/docs/specs/architecture.md`
- `<repo_root>/docs/specs/database-design.md`
- `<repo_root>/docs/specs/config-format.md`

正式文档发现规则：

- 上面这些是高优先级显式候选；存在就优先读。
- 如果仓库有 `docs/README.md`、文档索引或导航页，优先根据导航页判断该读哪些正式文档。
- 如果 `docs/specs/`、`docs/design/`、`docs/plans/`、`docs/adr/`、`docs/decisions/` 或相似目录存在，只读取最相关、最显眼的少量文件，不做无目的批量加载。
- 如果仓库没有固定命名，不要卡死在 `architecture.md` / `database-design.md` / `config-format.md`；应继续查找真实存在、语义明确的正式文档，如文件名或标题明显包含：
  - `architecture` / `arch`
  - `database` / `schema` / `data-model`
  - `config` / `settings`
  - `design`
  - `spec`
  - `plan` / `roadmap`
  - `adr` / `decision`
- 只读取能帮助判断真值源、结构边界、目录职责、验证方式的少量高信号文档；不要为了"看起来全面"批量扫完整个 `docs/`。
- 如果仓库根没有 `docs/`，也可以检查根目录或其他明显正式文档目录下的 `README`、`ARCHITECTURE*`、`DESIGN*`、`SPEC*`、`PLAN*`、`ADR*`、`DECISION*` 一类真实文件。

如果 `<repo_root>/memory/archive/` 存在：

- 优先只读当月文件
- 如果当月文件不存在，则最多读取最近一个归档文件作为格式和近期上下文参考
- 不批量加载整段历史 archive

#### 2b. Scan repository structure and engineering signals

探测并提取：

- 顶层目录：`apps/`、`packages/`、`services/`、`libs/`、`src/`、`config/`、`docs/`、`tests/`、`scripts/`
- manifest / build / ecosystem 文件：
  - Node / TS：`package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`package-lock.json`、`yarn.lock`、`turbo.json`、`nx.json`
  - Python：`pyproject.toml`、`uv.lock`、`poetry.lock`、`requirements.txt`、`requirements-dev.txt`、`Pipfile`
  - Go / Rust：`go.mod`、`Cargo.toml`
  - JVM：`pom.xml`、`build.gradle`、`build.gradle.kts`、`settings.gradle`、`settings.gradle.kts`
  - Ruby / PHP：`Gemfile`、`composer.json`
  - 通用构建与运行：`Makefile`、`Taskfile.yml`、`Taskfile.yaml`、`Justfile`、`justfile`、`Dockerfile`、`docker-compose.yml`、`docker-compose.yaml`
  - CI / 自动化：`.github/workflows/*.yml`、`.github/workflows/*.yaml`、`.gitlab-ci.yml`、`.circleci/config.yml`
- 关键信息：
  - 环境 / 语言 / 运行时
  - 主要框架和依赖类型
  - 标准验证命令
  - 配置目录
  - 核心模块或目录职责
  - 关键入口文件或路径（如 `main` / `app` / `router` / `server` / `cli` / 核心 service）
  - 分层边界或依赖方向（如 `api -> service -> engine -> infrastructure`、`app -> packages`、`web -> api`）
  - 项目共享协作目录（如 `.codex/skills/`、`config/agents`、`config/workflows`）如果存在

标准验证命令抽取规则：

- 只能从仓库内**显式存在**的信号提取标准验证命令，例如：
  - manifest 中已声明的 script / task
  - `Makefile` / `Taskfile*` / `Justfile` 的真实 target
  - CI 配置中的真实校验命令
  - `README`、`docs`、现有 `AGENTS.md` / `CLAUDE.md` / `tools.md` 中明确写出的验证命令
- 优先保留仓库里已经存在的原始命令写法，不擅自改写成另一套"更常见"的命令风格。
- 如果仓库里没有明确验证命令，只能写 `[待补充]`，不能因为看到了某个生态文件就自行猜成 `npm test`、`pnpm lint`、`pytest`、`cargo test` 等习惯命令。
- `tools.md` 中的"定向验证命令"同样只允许来自显式信号，不能从目录名或测试框架习惯反推。

#### 2c. Classify existing rule files

对 `AGENTS.md` / `CLAUDE.md` 做简单判断：

- **substantive**：包含真实项目规则、结构约束、命令、协作规则、模块边界等内容
- **non-substantive**：不存在，或只是指针、空壳、占位、薄内容文件

这里不需要再细分更多类型。关键只在于：

- 有没有可用的 substantive 规则文件
- 有没有现有文件需要先备份

#### 2d. Git history for memory initialization

如果仓库已有提交历史，且 `memory.md` 缺失或明显只是空壳/占位内容，则读取最近提交来初始化记忆。

默认只看最近 **8** 条提交：

```bash
git log -n 8 --date=short --pretty=format:'%ad%x09%s'
```

如果提交标题过于笼统，再补看同样 8 条提交涉及的文件：

```bash
git log -n 8 --date=short --name-only --pretty=format:'COMMIT %h %ad %s'
```

使用原则：

- git 历史只用于初始化 `memory.md`
- 只提炼近期完成能力、正在推进的方向、最近活跃窗口
- 不把 git 历史当正式真值源
- 不从 git 历史伪造长篇 archive 历史

为什么默认看 8 条：

- 少于 5 条通常不足以看出近期方向
- 多于 10 条通常噪音明显上升
- 8 条足够覆盖大多数项目最近 2~3 个工作窗口

#### 2e. Determine branch

只分两种：

#### 情况 A：项目中没有 substantive 规则文件

只要 `AGENTS.md` 和 `CLAUDE.md` 都不是 substantive，就进入"全新初始化模式"。

处理规则：

- 如果两者都不存在：直接按模板创建 `AGENTS.md`
- 如果其中任一存在但属于 non-substantive：先备份已有文件，再按模板创建 `AGENTS.md`

#### 情况 B：项目中已经有 substantive 规则文件

只要 `AGENTS.md` 或 `CLAUDE.md` 至少有一个是 substantive，就进入"归一优化模式"。

此时不再询问，直接进入"归一优化模式"：

- 先备份已有文件到项目根 `init-project.backup/[timestamp]/`
- 再按当前标准生成新的 canonical `AGENTS.md`
- 如果已有 `CLAUDE.md`，则改写为 `@AGENTS.md`

### Step 3: Apply Normalization Principles

Read `references/rules.md` for the full set of hard rules and normalization principles.

The `AGENTS.md` generation formula：

```
AGENTS.md = 固定协作骨架 + 当前仓库事实 + 用户已有有效规则
```

Information priority (by category)：

1. **协作记忆体系规则**
   - 以固定协作骨架为准
   - 仓库已有写法如果更强且不冲突，可继承
2. **结构、技术栈、目录职责、入口、验证命令**
   - 以当前仓库事实和正式文档为准
   - 不能被陈旧规则文件覆盖
3. **项目特定约束**
   - 优先继承用户已有 substantive 规则
   - 再用正式文档和当前代码做校验与补强
   - 如果仓库里没有，就不要发明
4. **近期活动线索**
   - 只用于 `memory.md` 初始化或补强
   - 不进入 `AGENTS.md` 的正式规则区

### Step 4: Generate or Enhance `AGENTS.md`

Read `references/templates.md` for the default skeleton template.

`AGENTS.md` 是最终 canonical 规则文件，必须至少覆盖以下内容。

#### 4a. Mandatory Sections

##### `## 0. 实施基线`

至少包含：

- 环境
- 语言 / 运行时
- 主要技术栈 / 关键依赖类别
- 配置根目录（如果存在）
- 标准验证命令

##### `## 1. 作用`

至少说明：

- 本文件是项目级硬规则
- 只保留长期约束实现结构的内容
- 详细设计回到 `docs/` 或正式文档

##### `## 2. Source of Truth`

至少说明：

- 正式设计文档优先于本文件
- `tools.md` / `memory.md` / `memory/archive/` 只是协作辅助，不是真值源
- 若项目已有明确文档优先级，则直接沿用并写成显式优先级清单
- 若项目没有成熟的 `docs/specs` 体系，则退化为"当前代码 / 配置 / README / 本文件"这类最小真实优先级
- 禁止臆造不存在的 `docs` 路径、spec 文件名或优先级层级

##### `## 3. 架构与项目结构`

至少包含：

- 根目录关键职责
- 核心模块 / 子应用 / 包目录
- 关键分层或边界
- 若可提取，补充依赖方向
- 若可提取，补充关键入口路径

##### `## 4. Agent 协作文件规则`

必须明确写清楚：

- 开始任务前，优先读项目根 `tools.md` 与 `memory.md`
- 只读取当前项目根的协作文件；`memory/archive/` 只按需读取当月或最近一个归档文件，不批量加载历史
- `tools.md` 记录稳定可复用的命令、路径、模式、坑点；写入前先读
- `memory.md` 是当前状态快照 + 最近活跃窗口；在完整功能/修复闭环后整体覆盖更新，不做流水追加
- `memory.md` 只保留：当前基线 / 已完成能力 / 进行中 / 关键决策 / 坑点 / 最近活跃窗口
- `memory.md` 更新时要删除失效项，目标 ≤120 行；超出时优先压缩"已完成能力"和"最近活跃窗口"
- `memory/archive/YYYY-MM.md` 是月度归档；只在重要根因分析、调试洞察、关键决策和踩坑时追加
- `memory/archive/YYYY-MM.md` 写入前先读当月文件；如果当月文件不存在，写入前先创建
- `memory/archive/YYYY-MM.md` 默认格式：`## [日期 | 标题]` + `- **Events**：` / `- **Changes**：` / `- **Insights**：`
- 稳定规律应整理进 `tools.md` 或正式文档，不要在 `memory.md` 和 archive 重复长期堆积
- 协作文件不得覆盖正式设计真值

##### `## 5. 验证、入口与关键路径`

至少包含：

- 标准验证命令
- 关键文档入口
- 若可提取，补充定向验证命令
- 若可提取，补充关键入口路径（如 app/router/server/main/service/cli）
- 若可提取，补充配置根目录、共享 skills 目录或关键生成目录

##### `## 6. 项目特定规则`

至少包含：

- 从现有规则 / 文档 / 结构中提取出的架构约束
- 模块边界
- 关键禁止事项或依赖方向
- 优先写模块归属、依赖方向、真值源边界、必须遵守的实现约束
- 如果仓库已有强信号，可拆成多个独立小节，不必强塞回一段摘要
- 如果信号弱，保持简洁和事实化，不要为了"看起来完整"发明大段通用禁令

##### `## 7. 维护原则`

至少说明：

- 保持短、小、硬
- 不把阶段性历史塞进规则文件
- 近期状态进 `memory.md`
- 长期稳定协作知识进 `tools.md`
- 项目特定解释性长文回到 `docs/` 或正式文档，不堆进 `AGENTS.md`

#### 4b. 条件独立小节

当仓库已有足够强的 substantive 信号时，除了最小骨架外，还应额外生成独立小节，而不是都塞进 `## 6`：

- `架构基线`
- `模块规则`
- `分层依赖规则`
- `shared/core 规则`
- `workflow 特别规则`
- `文档同步规则`
- `禁止事项`

使用条件：

- 现有 substantive 规则文件中已明确写出
- 正式设计文档已有稳定边界定义
- 当前代码结构已经足够清晰，拆成独立小节能减少歧义

没有强信号时，不要为了"看起来完整"硬造这些小节。

### Step 5: Generate Compatible `CLAUDE.md`

默认不新建 `CLAUDE.md`。

如果仓库里已经存在 `CLAUDE.md`，则在备份后改写为：

```markdown
# [项目名] - 项目指令

@AGENTS.md
```

### Step 6: Generate or Enhance `tools.md`

Read `references/templates.md` for the tools.md template.

先判断 `tools.md` 是否有可用 substantive 内容：

- 如果几乎没有真实命令、路径、模式、坑点内容，则视为 non-substantive
- 否则视为 substantive

如果 `tools.md` 已存在且有实质内容：

- 先读取并保留已有高质量条目
- 如果现有内容已经满足当前标准，只补缺失 section 和缺失的高信号条目
- 如果现有内容结构混乱、信号太弱、一次性日志过多、缺少关键命令/路径/入口/坑点，则先备份，再基于"已有有效内容 + 当前仓库事实"归一重写
- 清理明显的任务流水账、一次性调试记录和已失效的临时说明

如果不存在，则直接创建至少包含模板内容。

如果已存在但属于 non-substantive，则在备份后按同样模板重建。

生成原则：

- `tools.md` 只记录长期可复用的协作知识，不写当前单次任务日志。
- `Tools` 小节优先写精确命令、具体路径、明确入口，不写空泛口号。
- `Patterns` 只收录明确仍有效、会重复出现的稳定做法；一次性步骤不要放进去。
- `Pitfalls` 只收录可复用的坑点和环境注意事项；当天流水账不要放进去。
- 单个 section 没有足够信号时，保留一条 `[待补充：当前仓库暂无足够稳定信号]` 即可，不要堆占位。

### Step 7: Generate or Initialize `memory.md`

Read `references/templates.md` for the memory.md template.

先判断 `memory.md` 是否有可用 substantive 内容：

- 如果没有真实的"已完成能力 / 进行中 / 关键决策 / 坑点 / 最近活跃窗口"内容，则视为 non-substantive
- 否则视为 substantive

如果 `memory.md` 已存在且有实质内容：

- 先读取并保留仍有效内容
- 如果现有内容已经满足当前标准，则不重写，只补极明显缺失 section
- 如果现有内容结构混乱、最近活跃窗口过期、失效项过多、超出行数限制、或明显不符合"当前快照 + 最近窗口"定位，则先备份，再基于"已有有效内容 + 当前仓库状态 + 当月 archive（如果存在）+ 最近 8 条 git 提交"归一重写

如果不存在，则直接基于"当前仓库状态 + 当月 archive（如果存在）+ 最近 8 条 git 提交"初始化。

如果已存在但属于 non-substantive，则在备份后基于同样来源重建。

初始化约束：

- 不把很久之前的历史硬塞进"最近活跃窗口"
- 不凭提交标题臆造不存在的能力
- 近期提交只用于补足 `已完成能力`、`进行中 / 未完成`、`最近活跃窗口`
- `已完成能力` 只写当前仓库仍成立的闭环能力，不直接搬运 commit 标题
- `进行中 / 未完成` 只写当前文档、规则、工作树或近期提交能明确证明的方向
- `关键决策` 只保留仍有效的决策；已失效的不要带入
- `仍需注意的坑点` 只保留可复用坑点，不写一次性流水账
- `最近活跃窗口` 只保留最近 2~3 天的 3~8 条一句话摘要；超出范围的删掉
- 初始化或重建后的 `memory.md` 应整体可读，目标 ≤120 行；超出时优先压缩"已完成能力"和"最近活跃窗口"

### Step 8: Generate `memory/archive/YYYY-MM.md`

先确保目录存在：

```bash
mkdir -p "<repo_root>/memory/archive"
```

如果当月归档文件已存在：

- 写入前先读当前内容
- 只追加，不覆盖历史
- 不批量改写旧条目
- 如果文件只是空壳、占位或明显不符合归档格式，先备份后按标准头部重建，再追加本次记录
- 如果同一天已经存在语义等价的 `init-project` 初始化记录，不重复追加第二条

如果当月归档文件不存在，则创建（模板见 `references/templates.md`）。

如果本次是基于 git 历史初始化 `memory.md`，可在同一条初始化记录里补一句：

- **Changes**：`memory.md` 的初始内容参考了最近 8 条 git 提交，用于恢复近期项目状态。

注意：

- 不要把最近 8 条提交逐条硬转成 archive 历史
- archive 从这次初始化之后开始长期维护即可

### Step 9: Quality Gate

输出结果前，必须回读生成结果并确认：

- `AGENTS.md` 不是空骨架，至少已经写入基线、结构/依赖/入口、协作文件生命周期规则
- `tools.md` 至少包含真实命令、路径、模式、坑点中的高信号内容，不是纯占位
- `memory.md` 的"已完成能力"不是 commit 标题堆砌，"最近活跃窗口"只覆盖最近 2~3 天
- 如果仓库存在 `CLAUDE.md`，其最终内容只剩 `@AGENTS.md`
- 所有被重写的文件都已备份到项目根 `init-project.backup/[timestamp]/`
- 如果仓库原本存在 substantive `AGENTS.md` 或 `CLAUDE.md`，必须额外确认：
  - 其中仍有效的模块边界、真值源规则、项目特定禁令、文档优先级、验证命令已经迁移进新的 `AGENTS.md`，而不是静默丢失
  - 已被正式文档或当前代码证明失效的旧规则，已经在归一过程中删除，而不是原样带入
  - 只有在确实无法确认时才允许写 `[待人工确认]`；默认应主动归并，不要把本可解析的问题都留给用户
- 如果仓库原本存在 substantive `tools.md`，必须额外确认：
  - 其中仍有效的真实命令、关键路径、稳定模式、可复用坑点已经保留或合并进新的 `tools.md`
  - 被删除的旧条目确实已经失效、重复或属于一次性流水账，而不是静默丢掉高价值协作知识
- 如果仓库原本存在 substantive `memory.md`，必须额外确认：
  - 其中仍有效的"已完成能力 / 进行中 / 关键决策 / 坑点"已保留或合并进新的 `memory.md`
  - 被移除的旧内容确实因为过期、失效或超出"当前快照 + 最近窗口"定位而删除，不是静默丢掉仍有效状态

### Step 10: Output Summary

最后输出简明总结，至少包含：

- 项目根目录
- 走的是哪一种情况：全新初始化 / 已有规则归一
- 是否做了规则文件备份，备份路径是什么
- 创建了哪些文件
- 补强了哪些已有文件
- 是否把已有 `CLAUDE.md` 改写为 `@AGENTS.md`
- 从现有规则 / 文档 / git 历史提取了哪些关键信息
- 仍需人工补充的项
