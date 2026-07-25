# Zhanggui（掌柜）v0.4

面向强模型、对非专业用户友好的单入口开发工作流。运行实现位于本目录，自包含、无外部依赖。

> 本 README 只是导览，不参与运行，也不复述规则细节——避免出现第三份会漂移的"真值"。运行契约以 [`skills/zhanggui/SKILL.md`](skills/zhanggui/SKILL.md) 与各 `STAGE.md` 为准；完整设计论证见 [Skill 融合工作流设计](docs/skill-fusion-design.md)。

## 快速使用

只调用一次：

```text
/zhanggui
```

随后直接描述目标。入口在同一编排 frame 内完成：

```text
意图判断
  -> 建立可恢复 WorkflowState
  -> 按 decision node owner 调度设计
  -> 必要时做 UI/逻辑 prototype
  -> Transient / Durable / Epic
  -> TDD、执行、调试
  -> 新鲜验证
```

阶段切换不需要再次输入 slash command。

## 运行结构

```text
zhanggui/
├── .codex-plugin/plugin.json     # Codex plugin manifest（skills root -> ./skills/）
├── README.md
├── docs/                         # 设计文档
│   └── skill-fusion-design.md
└── skills/                       # plugin skills root
    └── zhanggui/                 # 唯一可发现入口 = 自包含可移植 skill
        ├── SKILL.md
        ├── RECOVERY.md           # task-root 与冷启动细则，按需读取
        ├── agents/openai.yaml    # Codex policy；Claude 侧由 frontmatter 承担
        └── stages/               # supporting docs，不参与 discovery
            ├── design-assist/STAGE.md
            ├── grilling/STAGE.md
            ├── prototype/{STAGE,UI,LOGIC}.md
            ├── writing-plans/STAGE.md
            ├── executing-plans/STAGE.md
            ├── test-driven-development/STAGE.md
            ├── systematic-debugging/STAGE.md
            ├── verification-before-completion/STAGE.md
            ├── code-review/{STAGE,code-reviewer}.md
            ├── finishing-a-development-branch/STAGE.md
            ├── using-git-worktrees/STAGE.md
            └── dispatching-parallel-agents/STAGE.md
```

### 两种安装形态（同一份文件）

skill 目录 `skills/zhanggui/` 是自包含的可移植单元，无需构建：

1. **插件形态**：宿主加载 `.codex-plugin/plugin.json`（skills root 指向 `./skills/`）。
2. **裸 skill 形态**：把 `skills/zhanggui/` 整个文件夹复制到宿主 skills 目录（`~/.claude/skills/zhanggui/`、`~/.agents/skills/zhanggui/` 或 Codex 对应目录）即可用 `/zhanggui`。

不会全量加载：Agent Skills 是三级渐进加载——启动只注入 frontmatter 的 name/description 一两行；调用 `/zhanggui` 时才加载 SKILL.md 正文；`stages/` 与 `RECOVERY.md` 只有被导航表按需 Read 才进上下文。这也是官方大型 skill 的标准组织方式。同一 skill 不要以两种形态同时启用，也不要与另一套默认强编排入口同时启用。

### 宿主调用模型

- `skills/zhanggui/SKILL.md` 是 plugin 唯一的 `SKILL.md`，Claude 设置 `disable-model-invocation: true`，Codex 设置 `allow_implicit_invocation: false`。
- 用户只在开始时调用一次 `/zhanggui`；explicit-only 是为了避免普通问答被重工作流自动接管。
- 不增加浅层 auto-router：model-invoked router 无法调用 user-only 主入口，只会制造第二套编排。
- 入口保持为整个会话的 orchestration frame，按需读取一个 `STAGE.md`；stage 返回 delta，不 invoke 自己或 sibling。
- `stages/` 与 `RECOVERY.md` 都不参与 skill discovery。

## 核心概念地图

规则原文只在右列出处维护（`stages/...` 相对 skill 目录 `skills/zhanggui/`），此表只是索引：

| 概念 | 一句话 | 规则出处 |
|---|---|---|
| WorkflowState | 全会话唯一状态对象；简单任务只用最小投影 | SKILL.md「WorkflowState」 |
| 意图路由 | 恢复/问答/bug/计划/局部改动/想法/fog 的入口分流 | SKILL.md「第 0 级」 |
| Decision owner | 以决策节点为单位分权：Assisted / Owner / Mixed | SKILL.md「第 1 级」 |
| UI mode | Prototype-Assisted / Design-Owner / Direct / Text-Only，与业务 owner 正交 | SKILL.md「第 1.5 级」 |
| Prototype | 用可运行证据回答一个决策节点，delta 合并回 parent | `stages/prototype/` |
| Fog discovery | 大而模糊工作的发现循环，只产生决定不产生实现 | SKILL.md「Fog 发现循环」 |
| 共识与 readiness | user-owned 决策必须 recap 确认；五级 readiness 硬门 | SKILL.md「共识与 Readiness 硬门」 |
| Shape 与真值 | Transient 会话 plan / Durable TODO.csv / Epic 父子 CSV，单一真值 | `stages/writing-plans/`、`stages/executing-plans/` |
| 恢复 | 压缩 state 块 + 机械触发的 DESIGN checkpoint + 冷启动流程 | SKILL.md「跨会话设计检查点」、`RECOVERY.md` |
| 质量与收尾 | code review 双轴（质量+忠实）、分支收尾选项、worktree 隔离、并行派发——按需加载，不用不占上下文 | `stages/code-review/` 等 4 个 stage |

与模型内置 plan 的关系：模型 plan 保持短（目标与即时进度），磁盘 tracker 只补执行细节（boundary、related_files、sync_targets、depends_on、validation），会话 plan 是磁盘 CSV 的镜像投影。细节见 `stages/writing-plans/STAGE.md`「与模型 plan 的互补」。

## Runtime

### 唯一可发现入口

- `zhanggui`

### 任务目录与迁移

v0.4 默认根仍为 `.tasks/`。不存在/空目录可采用并创建 `.zhanggui-root`；非空目录只有 marker 版本匹配才自动视为本工作流所有。默认根不可用时，项目根 `.zhanggui/config.yaml` 可用 `version` + 项目内相对 `task_root` 声明自定义根；否则使用确定性后备 `.zhanggui/tasks/`。完整细则见入口旁 [`RECOVERY.md`](skills/zhanggui/RECOVERY.md)。已有项目的旧任务目录只能显式采用、一次性导入或保留隔离，禁止静默合并和双写。

### 文档维护

生产代码的文件行数可作为拆分信号；Skill、STAGE 和设计文档不设 300 行硬上限。必要时按职责做 progressive disclosure，但不得为满足数字删除约束、示例或可读空白。

## 验收场景

40 条权威验收场景见 [设计文档 §12](docs/skill-fusion-design.md)。建议的冒烟子集（先跑这 6 条）：Assisted 冷启动、Mixed 一次一问、原生提问分发、prototype detour 合并、design-drift、冷启动恢复。
