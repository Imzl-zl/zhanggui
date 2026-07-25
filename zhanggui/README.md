# Zhanggui（掌柜）v0.5

面向强模型、对非专业用户友好的开发工作流：一个 explicit-only 有状态编排器，加八个可独立发现、可复用的工程 leaf skills。运行实现位于本目录，无构建依赖。

> 本 README 只是导览，不参与运行，也不复述规则细节——避免出现第三份会漂移的“真值”。运行契约以 [`skills/zhanggui/SKILL.md`](skills/zhanggui/SKILL.md)、各 leaf `SKILL.md` 与内部 `STAGE.md` 为准；完整设计论证见 [Skill 融合工作流设计](docs/skill-fusion-design.md)。

## 快速使用

完整工作流只调用一次：

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

调试、TDD、完成验证、请求/接收审查、worktree、并行派发或分支收尾等窄任务也可单独描述，由宿主发现对应 leaf skill；Direct 模式不会虚构掌柜的 WorkflowState。完整工作流中，同一 leaf 由 `/zhanggui` 按 `Zhanggui Embedded` 契约加载。

## 运行结构

```text
zhanggui/
├── .codex-plugin/plugin.json     # skills root -> ./skills/
├── README.md
├── docs/skill-fusion-design.md
└── skills/
    ├── zhanggui/                 # explicit-only 有状态编排器
    │   ├── SKILL.md
    │   ├── RECOVERY.md
    │   ├── agents/openai.yaml
    │   └── stages/               # 共享状态步骤，不参与 discovery
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

### 两种安装形态（同一 collection）

完整可移植单元是 `skills/` 下的 `zhanggui/` 与全部 `zhanggui-*` sibling 目录，无需构建：

1. **插件形态**：宿主加载 `.codex-plugin/plugin.json`（skills root 指向 `./skills/`）。
2. **裸 collection 形态**：把 `skills/zhanggui/` 和全部 `skills/zhanggui-*` 目录一起复制到宿主 skills 根（如 `~/.claude/skills/` 或 `~/.agents/skills/`），保持 sibling 布局。

只复制 `skills/zhanggui/` 会缺少 Embedded leaf 依赖，不是完整安装。Agent Skills 仍是渐进加载：启动只注入九个技能的 frontmatter；实际匹配后才加载对应 `SKILL.md`；根编排器也只按导航表读取当前内部 stage 或 leaf。不要同时启用插件与裸 collection，也不要同时启用另一套默认强编排入口。

### 宿主调用模型

- `skills/zhanggui/SKILL.md` 是唯一默认强编排入口：Claude 设置 `disable-model-invocation: true`，Codex 设置 `allow_implicit_invocation: false`。
- 八个 `zhanggui-*` leaf 都有独立 `SKILL.md` 和 `Use when ...` description，可由宿主发现或显式调用；每个 leaf 都定义 `Direct` 与 `Zhanggui Embedded` 两种契约。
- 用户启动完整工作流时只调用一次 `/zhanggui`；阶段切换不要求继续输入命令。
- 不增加浅层 auto-router：root 保持整段会话 frame，直接读取内部 stage 或 sibling leaf 并合并 delta。
- `design-assist`、`grilling`、`prototype`、`writing-plans`、`executing-plans` 保持内部 `STAGE.md`；`RECOVERY.md` 也不参与 discovery。

## 核心概念地图

规则原文只在右列出处维护（内部 `stages/...` 相对 `skills/zhanggui/`；leaf 位于 `skills/zhanggui-*/`），此表只是索引：

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
| 质量与收尾 | 审查双轴、分支收尾、worktree 隔离、并行派发——既可独立使用，也可嵌入根 frame | 对应 `skills/zhanggui-*/SKILL.md` |

与模型内置 plan 的关系：模型 plan 保持短（目标与即时进度），磁盘 tracker 只补执行细节（boundary、related_files、sync_targets、depends_on、validation），会话 plan 是磁盘 CSV 的镜像投影。细节见 `stages/writing-plans/STAGE.md`「与模型 plan 的互补」。

## Runtime

### 可发现技能

- `zhanggui`（explicit-only 有状态编排器）
- `zhanggui-systematic-debugging`
- `zhanggui-test-driven-development`
- `zhanggui-verification-before-completion`
- `zhanggui-requesting-code-review`
- `zhanggui-receiving-code-review`
- `zhanggui-using-git-worktrees`
- `zhanggui-dispatching-parallel-agents`
- `zhanggui-finishing-a-development-branch`

### 任务目录与迁移

v0.5 继续使用 `zhanggui/v0.4` WorkflowState 与 task-root schema。默认根仍为 `.tasks/`：不存在/空目录可采用并创建 `.zhanggui-root`；非空目录只有 marker 版本匹配才自动视为本工作流所有。默认根不可用时，项目根 `.zhanggui/config.yaml` 可用 `version` + 项目内相对 `task_root` 声明自定义根；否则使用确定性后备 `.zhanggui/tasks/`。完整细则见入口旁 [`RECOVERY.md`](skills/zhanggui/RECOVERY.md)。已有项目的旧任务目录只能显式采用、一次性导入或保留隔离，禁止静默合并和双写。

### 文档维护

生产代码的文件行数可作为拆分信号；Skill、STAGE 和设计文档不设 300 行硬上限。必要时按职责做 progressive disclosure，但不得为满足数字删除约束、示例或可读空白。

## 验收场景

42 条权威验收场景见 [设计文档 §12](docs/skill-fusion-design.md)。建议的冒烟子集：Assisted 冷启动、Mixed 一次一问、原生提问分发、prototype detour 合并、design-drift、冷启动恢复、leaf Direct/Embedded 边界。
