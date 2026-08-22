# Zhanggui（掌柜）v0.7

Nine strict Agent Skills: one selective-hybrid stateful Zhanggui orchestrator and eight dual-mode engineering leaves.

面向强模型、对非专业用户友好的开发工作流：一个 selective-hybrid 有状态编排器，加八个可独立发现、可复用的严格工程 leaf skills。运行实现位于本目录，无构建依赖。

> 本 README 只是导览，不参与运行，也不复述规则细节——避免出现第三份会漂移的“真值”。运行契约以 [`skills/zhanggui/SKILL.md`](skills/zhanggui/SKILL.md)、各 leaf `SKILL.md` 与内部 `STAGE.md` 为准；完整设计论证见 [Skill 融合工作流设计](docs/skill-fusion-design.md)。

## v0.7 架构要点

- **Nine strict catalog entries**：九个技能均使用 strict Agent Skills frontmatter；`zhanggui` 是唯一有状态根，拥有 `WorkflowState`、return point、readiness 与 Embedded 合并权。
- **选择性 Hybrid 根**：高信号复杂请求可自动进入；任何时候也可用宿主原生命令手动进入。
- **内部协议**：`SkillRequest` / `SkillResult` 是 Zhanggui 根拥有的内部协议，不是 Agent Skills 开放标准字段。
- **激活顺序**：native activation → catalog location → controlled collection fallback；业务路由只写 skill name + mode。
- **内部 stage 不加载 sibling**：`design-assist`、`grilling`、`prototype`、`writing-plans`、`executing-plans` 永不加载 sibling skills；返回本地 state/task/node delta，并在需要 leaf 时返回 `SkillRequest` 供根消费。
- **验证命令**：trigger eval 与 clean-host acceptance 见下方命令；完整 collection 仍是唯一安装单元。

## 快速使用

复杂、跨模块、多交付物、checkpoint 恢复或明确端到端的请求可以直接描述；支持 model-selected skills 的宿主会选择性自动加载 `zhanggui`，根在首次工具调用前说明进入原因。调试、TDD、验证、审查、反馈、worktree、并行派发和分支收尾等窄请求仍由对应 leaf 自动匹配。

需要确定性进入完整流程时，只显式调用一次根：

- **OMP 交互式**：`/skill:zhanggui`
- **提供同名 alias 的宿主**：`/zhanggui`

阶段切换和 Embedded leaf handoff 不要求继续输入命令。

入口在同一编排 frame 内完成：

```text
意图判断
  -> 建立可恢复 WorkflowState
  -> 按 decision node owner 调度设计
  -> 必要时做 UI/逻辑 prototype
  -> Transient / Durable / Epic
  -> TDD、执行、调试
  -> 新鲜验证
```

调试、TDD、完成验证、请求/接收审查、worktree、并行派发或分支收尾等窄任务也可单独描述，由宿主发现对应 leaf skill；Direct 模式不会虚构掌柜的 WorkflowState。完整工作流中，同一 leaf 由根通过 `SkillRequest` 按 `Zhanggui Embedded` 契约激活并合并 `SkillResult`。

## 运行结构

```text
zhanggui/
├── .codex-plugin/plugin.json     # skills root -> ./skills/
├── README.md
├── docs/skill-fusion-design.md
├── evals/                        # trigger datasets + routing summary
├── scripts/validate-agent-skills.mjs
├── tests/                        # discovery / routing / trigger contracts
└── skills/
    ├── zhanggui/                 # selective-hybrid strict orchestrator
    │   ├── SKILL.md
    │   ├── RECOVERY.md
    │   ├── agents/openai.yaml
    │   └── stages/               # shared-state steps, undiscoverable
    │       ├── design-assist/STAGE.md
    │       ├── grilling/STAGE.md
    │       ├── prototype/{STAGE,UI,LOGIC}.md
    │       ├── writing-plans/{STAGE,plan-document-reviewer-prompt}.md
    │       └── executing-plans/STAGE.md
    ├── zhanggui-systematic-debugging/SKILL.md
    ├── zhanggui-test-driven-development/SKILL.md
    ├── zhanggui-verification-before-completion/SKILL.md
    ├── zhanggui-requesting-code-review/{SKILL,code-reviewer}.md
    ├── zhanggui-receiving-code-review/SKILL.md
    ├── zhanggui-using-git-worktrees/SKILL.md
    ├── zhanggui-dispatching-parallel-agents/SKILL.md
    └── zhanggui-finishing-a-development-branch/SKILL.md
```

### 安装单元：完整 collection

完整可移植单元是 `skills/` 下的 `zhanggui/` 与全部 `zhanggui-*` 目录，无需构建：

1. **插件形态**：宿主加载 `.codex-plugin/plugin.json`（skills root 指向 `./skills/`）。
2. **裸 collection 形态**：把 `skills/zhanggui/` 和全部 `skills/zhanggui-*` 目录一起复制到宿主 skills 根（如 `~/.claude/skills/` 或 `~/.agents/skills/`），保持 collection 布局。

只复制 `skills/zhanggui/` 会缺少 Embedded leaf 依赖，不是完整安装。Agent Skills 仍是渐进加载：启动只注入九个技能的 frontmatter；实际匹配后才加载对应 `SKILL.md`。根编排器通过 Skill Activation Contract 激活 leaf，而不是把 sibling 路径当作业务接口。不要同时启用插件与裸 collection，也不要同时启用另一套默认强编排入口。

### 宿主调用模型

- 九个技能的 `name` + `description` 全部 catalog-visible；根与八个 leaf 均可被宿主按 description 自动匹配，也可通过宿主原生命令手动调用。
- `skills/zhanggui/SKILL.md` 是唯一默认强编排入口，采用选择性 Hybrid：高信号完整生命周期请求可自动进入，也可显式调用；Codex profile 设置 `allow_implicit_invocation: true`。
- 八个 `zhanggui-*` leaf 都有独立 `SKILL.md` 和 `Use when ...` description；每个 leaf 都定义 `Direct` 与 `Zhanggui Embedded` 两种契约。
- 确定性进入完整工作流时只显式调用一次根编排器（OMP 交互式为 `/skill:zhanggui`；逻辑 alias 为 `/zhanggui`）；阶段切换不要求继续输入命令。
- Embedded 路径只接受根提供的 `SkillRequest`，leaf/stage 返回 `SkillResult` 或请求；根按 native activation → catalog location → collection fallback 激活，并校验 frontmatter 身份后合并 delta。
- `design-assist`、`grilling`、`prototype`、`writing-plans`、`executing-plans` 保持内部 `STAGE.md`，永不加载 sibling skills；返回本地 state/task/node delta，并在需要 leaf 时返回 `SkillRequest` 供根消费；`RECOVERY.md` 也不参与 discovery。

## 核心概念地图

规则原文只在右列出处维护（内部 `stages/...` 相对 `skills/zhanggui/`；leaf 位于 `skills/zhanggui-*/`），此表只是索引：

| 概念 | 一句话 | 规则出处 |
|---|---|---|
| WorkflowState | 全会话唯一状态对象；简单任务只用最小投影 | SKILL.md「WorkflowState」 |
| SkillRequest/Result | 根拥有的 Embedded 激活/合并协议 | SKILL.md「Skill Activation Contract」 |
| 意图路由 | 恢复/问答/bug/计划/局部改动/想法/fog 的入口分流 | SKILL.md「第 0 级」 |
| Decision owner | 以决策节点为单位分权：Assisted / Owner / Mixed | SKILL.md「第 1 级」 |
| UI mode | Prototype-Assisted / Design-Owner / Direct / Text-Only，与业务 owner 正交 | SKILL.md「第 1.5 级」 |
| Prototype | 用可运行证据回答一个决策节点，delta 合并回 parent | `stages/prototype/` |
| Fog discovery | 大而模糊工作的发现循环，只产生决定不产生实现 | SKILL.md「Fog 发现循环」 |
| 共识与 readiness | user-owned 决策必须 recap 确认；五级 readiness 硬门 | SKILL.md「共识与 Readiness 硬门」 |
| Shape 与真值 | Transient 会话 plan / Durable TODO.csv / Epic 父子 CSV，单一真值 | `stages/writing-plans/`、`stages/executing-plans/` |
| 恢复 | 压缩 state 块 + 机械触发的 DESIGN checkpoint + 冷启动流程 | SKILL.md「跨会话设计检查点」、`RECOVERY.md` |
| 质量与收尾 | 审查双轴、分支收尾、worktree 隔离、并行派发——既可独立使用，也可嵌入根 frame | 对应 `skills/zhanggui-*/SKILL.md` |

与模型内置 plan 的关系：模型 plan 保持短（目标与即时进度），磁盘 tracker 只补执行细节（boundary、related_files、sync_targets、depends_on、validation），会话 plan 是磁盘 CSV 的镜像投影。细节见 `stages/writing-plans/STAGE.md`「与模型 plan 的互补」。

## Runtime

### 可发现技能

- `zhanggui`（selective-hybrid strict orchestrator）
- `zhanggui-systematic-debugging`
- `zhanggui-test-driven-development`
- `zhanggui-verification-before-completion`
- `zhanggui-requesting-code-review`
- `zhanggui-receiving-code-review`
- `zhanggui-using-git-worktrees`
- `zhanggui-dispatching-parallel-agents`
- `zhanggui-finishing-a-development-branch`

### 任务目录与迁移

v0.7 继续使用 `zhanggui/v0.4` WorkflowState 与 task-root schema。默认根仍为 `.tasks/`：不存在/空目录可采用并创建 `.zhanggui-root`；非空目录只有 marker 版本匹配才自动视为本工作流所有。默认根不可用时，项目根 `.zhanggui/config.yaml` 可用 `version` + 项目内相对 `task_root` 声明自定义根；否则使用确定性后备 `.zhanggui/tasks/`。完整细则见入口旁 [`RECOVERY.md`](skills/zhanggui/RECOVERY.md)。已有项目的旧任务目录只能显式采用、一次性导入或保留隔离，禁止静默合并和双写。

### 文档维护

生产代码的文件行数可作为拆分信号；Skill、STAGE 和设计文档不设 300 行硬上限。必要时按职责做 progressive disclosure，但不得为满足数字删除约束、示例或可读空白。

## 验证与验收命令

### Automated verification

```bash
node --check tests/skill-discovery.test.mjs
node --check tests/skill-routing-contract.test.mjs
node --check tests/skill-trigger-data.test.mjs
node --test
node scripts/validate-agent-skills.mjs
```

Expected: zero test failures/todos；validator 最终行报告 `Validated 9 strict Agent Skills.`

### Trigger eval

```bash
node --test tests/skill-trigger-data.test.mjs
# catalog routing summary is recorded in evals/results/v0.7-routing-summary.json
```

Observed v0.7 summary facts:

- 122 cases × 3 runs = 366 original slots
- final total attempts 393 (366 initial + 27 transport-only retries)
- transport retry policy: max 3 waves, backoffs `[0, 5, 15]`, transport-errors-only; valid wrong selections never retried
- root rates: explicit/implicit/root-first-conflict = 1.0, root_false_positive = 0.0
- all eight leaf positives = 1.0 / negatives = 0.0
- focused trigger suite 10/10

### Clean-host native activation

从 `zhanggui/` 目录运行，使用已认证 profile、不落盘 session、限制 catalog 为 Zhanggui 名称。每个 finite JSONL case 使用独立空系统临时 cwd，避免污染的仓库 cwd。

**Supported Task 5 cases (6/6):**

| ID | Expectation |
|---|---|
| `native-root-explicit` | OMP 交互式 `/skill:zhanggui ...` host-direct 注入根，root-first |
| `native-root-implicit` | 无命令高信号请求自动加载 `zhanggui`，首次工具前出现 `已自动进入 Zhanggui 完整工作流：` |
| `native-debug` | 窄 bug 请求先激活 `zhanggui-systematic-debugging`，根不抢占 |
| `native-root-conflict` | 端到端 + TDD/verification 子步骤仍 root-first |
| `native-review` | 窄 review 请求先激活 `zhanggui-requesting-code-review`，根不抢占 |
| `fallback-debug` | `--no-skills` 下受控 collection fallback 读取 debugging leaf 并校验 frontmatter 身份 |

**Root（OMP 交互式，host-direct injection）：**

```bash
omp --no-session --no-rules --plugin-dir "$PWD" --skills "zhanggui*" --max-time 60
# then type interactively:
# /skill:zhanggui 设计并验证一个最小库存功能
```

期望：宿主在模型工作前直接注入 `zhanggui` 正文（TUI 可见 `✦ skill zhanggui ...` 与 `skills/zhanggui/SKILL.md` 路径），即 root-first。

**Implicit root / leaf / conflict（非交互 JSONL，独立 temp cwd）：**

```bash
# each case should use its own empty system-temp --cwd
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 \
  -p "我只有一个模糊的库存产品想法，请先查清需求和约束，再设计、实现并验证交付"
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 \
  -p "这个单元测试失败了，先系统化调查根因"
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 \
  -p "Own this end-to-end permissions redesign: resolve the open decisions, implement it with TDD, and carry it through final verification."
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 \
  -p "Review this cross-module diff only; do not implement, plan, or own end-to-end delivery."
```

期望：以 JSONL `tool_execution_*` / `skill://` 事件为准，不用助手散文冒充证据。

**Unsupported alias probe（excluded from supported totals）：**

```bash
omp --no-session --no-rules --cwd "$EMPTY_TEMP" --plugin-dir "$PWD" --skills "zhanggui*" --mode json --max-time 120 \
  -p "/zhanggui 设计并验证一个最小库存功能"
```

`omp -p "/zhanggui ..."` 与非交互 `omp -p "/skill:zhanggui ..."` 在 OMP 中不是有效 native-root 证据（未知 slash 仅作普通文本）。该 probe 记录但排除在 supported totals 之外。

### Collection fallback

禁用 native skill discovery，只追加根说明并允许 collection 目录；同样使用独立空 temp cwd：

```bash
omp --no-session --no-rules --no-skills --cwd "$EMPTY_TEMP" \
  --append-system-prompt skills/zhanggui/SKILL.md --add-dir skills \
  --mode json --max-time 120 \
  -p "/zhanggui 调查一个测试失败；使用已安装 collection 的 fallback 加载调试流程。Installed collection root: $PWD/skills"
```

期望：native skill 不可用时，根通过受控 collection fallback 读取 `zhanggui-systematic-debugging`，frontmatter `name` 精确匹配；缺失/身份错误以稳定 blocked code 暴露。

## 验收场景

47 条权威验收场景见 [设计文档 §12](docs/skill-fusion-design.md)。建议的冒烟子集：Assisted 冷启动、Mixed 一次一问、原生提问分发、prototype detour 合并、design-drift、冷启动恢复、leaf Direct/Embedded 边界、selective Hybrid discovery、native clean-host activation、collection fallback identity。
