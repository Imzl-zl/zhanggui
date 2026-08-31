# Zhanggui 选择性 Hybrid 调用设计

**状态：** 已确认，v0.7 实施真值  
**日期：** 2026-07-25  
**目标版本：** v0.7.0  
**适用范围：** `zhanggui/` plugin collection

## 1. 问题与证据

v0.6 已把 Zhanggui 拆成一个有状态根编排器、八个可独立发现的 leaf skills，以及五个不参与 discovery 的内部 stages。v0.6 时 / 变更前的调用策略并不统一：

- v0.6 时根 `zhanggui` 的 frontmatter 设置 `disable-model-invocation: true`。
- v0.6 时根的 `agents/openai.yaml` 设置 `policy.allow_implicit_invocation: false`。
- 八个 leaf 当时没有禁用自动调用，因此已经支持宿主按 description 自动匹配，也支持宿主提供的手动入口。
- 变更前的 trigger dataset 明确要求根的六个正例全部包含 `/zhanggui` 或显式 Zhanggui workflow 表述；它不能证明隐式自动调用。
- 变更前的 README、plugin metadata 和设计文档都把根描述为 explicit-only。

因此，“Zhanggui 必须手动触发”在 v0.6 时只对根成立，而且是当时的主动策略，不是 Agent Skills 开放规范的限制。

开放 Agent Skills specification 只规定技能目录和标准 frontmatter。`description` 必须说明技能做什么以及何时使用；所有技能的 `name` 和 `description` 在启动时进入 catalog，完整正文只在激活后加载。规范不定义跨宿主统一的自动/手动开关、slash command 名称或多技能优先级。

Claude Code 的成熟默认是同一个 skill 同时支持自动和手动调用：相关时自动加载，也可用 `/skill-name` 直接调用。`disable-model-invocation: true` 是 Claude 的宿主扩展，用于部署、发送消息等需要用户控制时机或有明显副作用的流程；默认值为 `false`。

来源：

- [Agent Skills specification](https://agentskills.io/specification)
- [Claude Code skills documentation](https://code.claude.com/docs/en/skills)
- [Codex skills documentation](https://developers.openai.com/codex/skills/)

## 2. 已确认决策

1. 根改为**选择性 Hybrid**：高信号完整生命周期请求可以自动进入，所有时候仍可手动调用。
2. 高信号自动命中后直接进入，并先用一句话告知原因；不增加确认阻塞。
3. 窄任务继续由八个 leaf 自动或手动闭环。
4. 使用同一个根 skill，不新增 auto-router skill。
5. collection 默认不依赖宿主 hook；企业部署未来可以额外增加确定性宿主策略，但不进入标准核心。
6. root-first 是唯一入口优先级；根加载后，leaf 只能通过现有 `SkillRequest` 进入 `Zhanggui Embedded` 模式。
7. 匹配不确定时不自动抢占根。
8. 自动/手动入口来源不持久化到 `WorkflowState`。
9. 触发评估升级为能分别衡量 explicit、implicit、near-miss 和 root-first 冲突的 v2 数据集。
10. 以 v0.7.0 发布，因为默认调用行为和兼容性声明发生变化。

## 3. 目标与非目标

### 3.1 目标

- 用户无需记住命令，也能在高信号复杂请求上进入完整 Zhanggui 工作流。
- 熟悉 Zhanggui 的用户仍可通过宿主原生命令确定性进入根。
- 简单 bug、TDD、验证、审查等请求不承担完整编排成本。
- 根与 leaf 不竞争同一窄意图。
- 保留完整 `skills/` collection、Direct/Embedded 和 `SkillRequest`/`SkillResult` 合同。
- 通过官方 validator、catalog eval 和 clean-host smoke 证明调用行为。
- 对宿主差异、误触发和不支持入口保持可观察失败。

### 3.2 非目标

- 不让所有开发请求都自动进入根。
- 不新增 `zhanggui-auto` 或第二个 router。
- 不用关键词脚本替代宿主的 skill discovery。
- 不把 `auto-trigger`、`priority`、`entry-source` 等非标准字段放进 Agent Skills frontmatter。
- 不把 entry source 写入恢复状态、tracker 或 checkpoint。
- 不改变八个 leaf 的专业过程、Direct/Embedded 业务合同或内部 stage 划分。
- 不承诺所有宿主使用同一个 slash command。
- 不宣称开放 Agent Skills specification 本身保证多技能激活顺序。

## 4. 目标架构

```text
Skill catalog
├── zhanggui
│   ├── explicit manual entry
│   ├── selective implicit entry
│   ├── WorkflowState owner
│   ├── SkillRequest consumer
│   └── SkillResult merger
├── zhanggui-systematic-debugging          direct + embedded
├── zhanggui-test-driven-development       direct + embedded
├── zhanggui-verification-before-completion direct + embedded
├── zhanggui-requesting-code-review        direct + embedded
├── zhanggui-receiving-code-review         direct + embedded
├── zhanggui-using-git-worktrees           direct + embedded
├── zhanggui-dispatching-parallel-agents   direct + embedded
└── zhanggui-finishing-a-development-branch direct + embedded

Undiscoverable internal resources
└── zhanggui/stages/*/STAGE.md
```

根删除唯一的非标准 frontmatter 字段后，也采用 strict Agent Skills frontmatter。根内部的 WorkflowState 和 Embedded 协议仍是 Zhanggui collection 的运行合同，不冒充开放标准。

## 5. 入口选择合同

### 5.1 优先级

目录选择和已加载后的执行必须遵循：

1. **Explicit root**：用户显式调用根时，根先于所有 leaf。
2. **Implicit root**：无显式调用，但请求满足完整生命周期高信号时，根自动进入。
3. **Direct leaf**：请求是明确窄工程过程时，对应 leaf 独立执行。
4. **No forced skill**：普通问答、解释或没有匹配能力的请求不强制进入根。

开放标准没有 skill priority 字段。v0.7 通过互斥 description、root body guard 和真实宿主验收实现该结果，而不是声称存在跨宿主的结构化优先级保证。

### 5.2 根自动正例

根只应自动匹配以下一种或多种高信号：

- 需求模糊，需要先发现约束或做真实设计决策。
- 请求跨模块、跨子系统或包含多个独立 deliverable。
- 用户明确要求从 discovery/design 一直完成到 implementation 和 verified delivery。
- 已存在 Zhanggui checkpoint，需要恢复长期或跨会话工作。
- 高风险迁移需要设计、执行、验证和恢复合同共同成立。
- 用户明确要求完整 Zhanggui workflow，但没有使用宿主命令。

### 5.3 根自动排除项

以下窄请求默认不自动进入根：

- 未知根因的 bug、测试失败、构建失败或性能异常。
- 已知行为的 TDD、回归修复或局部重构。
- 完成前验证。
- 请求新代码审查。
- 接收并核实 review feedback。
- 创建或管理隔离 worktree。
- 派发互不相关的并行 agents。
- 已验证分支的 merge、PR、keep 或 discard 收尾。
- 不改文件的普通问答、解释和研究。

如果用户显式调用根，上述排除不阻止根进入；根按既有路由表用最小 state 或 Embedded leaf 处理。

### 5.4 leaf 边界

每个 leaf 保留自己的窄正例，同时在 description 中表达共同排除边界：

- 当前请求显式调用 `zhanggui` 根时，不以 Direct 模式抢先执行。
- 当前请求是模糊、跨模块、多 deliverable 或明确端到端生命周期时，由根拥有入口。
- 根已加载并提供 `SkillRequest` 时，只走 `Zhanggui Embedded`。
- **new-vs-existing review boundary**：`requesting-code-review` 拥有新 diff/code change 的独立审查（含 Critical/Important 范围报告）；`receiving-code-review` 只处理已有 feedback/comments 的核实与接受/拒绝/实现，不抢新审查。
- **user-stated verified integration precedence**：当用户明确表示测试已通过/验证完成并主要请求分支集成（merge/PR/keep/discard）时，由 finishing leaf 拥有入口；verification leaf 不因“验证”字样抢占。

这条边界必须按每个 leaf 的自然语言重写，不能机械追加一段导致 description 失焦或超过 1024 字符。

## 6. 元数据设计

### 6.1 Root frontmatter

目标语义：

```yaml
---
name: zhanggui
description: Use when a development request is ambiguous, cross-module, multi-deliverable, checkpointed, or explicitly asks for end-to-end work from discovery or design through implementation and verified delivery. Also use when invoked explicitly. Do not use for isolated debugging, TDD, verification, review, review-feedback, worktree, parallel-agent, or branch-finishing requests handled by zhanggui-* skills.
compatibility: Requires the complete Zhanggui skill collection; automatic invocation requires a host that supports model-selected skills.
---
```

约束：

- 删除 `disable-model-invocation: true`。
- description 保持一个自包含的“能力 + when-to-use + exclusions”合同。
- 不增加 Claude-only 的 `when_to_use` 或自定义优先级字段。
- `compatibility` 只说明真实环境要求，不承载路由逻辑。

### 6.2 Codex profile

`skills/zhanggui/agents/openai.yaml` 调整为允许 implicit invocation，并同步短描述：

```yaml
interface:
  display_name: "Zhanggui（掌柜）"
  short_description: "Stateful end-to-end orchestrator for complex development work"
policy:
  allow_implicit_invocation: true
```

这是 Codex 宿主适配，不是开放 Agent Skills frontmatter。若目标 Codex 版本不识别该 policy，验收必须显示失败；不得假定默认值后宣称通过。

### 6.3 Plugin 与文档

plugin metadata 和 README 统一改为：

- 一个 selective-hybrid stateful root。
- 八个 automatic/manual dual-mode leaves。
- 九个 strict Agent Skills frontmatter。
- 完整 `skills/` collection 仍是唯一安装单元。
- OMP 手动入口仍为 `/skill:zhanggui`；支持同名 alias 的宿主可用 `/zhanggui`。
- 普通高信号请求可以自动进入根，窄请求由 leaf 匹配。

## 7. 运行时入口模式

### 7.1 Explicit

入口来源判定顺序：

1. 使用宿主提供的显式调用元数据（若真实存在）。
2. 否则检查当前用户请求中是否存在宿主原生根命令或逻辑 alias。
3. 两者都没有时视为 implicit。

Explicit 模式不需要额外进入说明，直接按根的第 0 级路由执行。显式调用始终覆盖自动排除项。

### 7.2 Implicit

Implicit 根在首次 non-skill 工具调用前输出一条简短进入说明；skill activation read 可以先于该说明。catalog-visible exact announcement marker is:

```text
已自动进入 Zhanggui 完整工作流：
```

followed by one concise freeform high-signal reason grounded in request or repository evidence. 要求：

- 原因必须来自用户请求或仓库证据，不能捏造复杂度，也不能固定白名单。
- 不询问“是否启用 skill”。
- 不创建永久 `EntryContext`。
- 进入说明只出现一次，且 marker 与 catalog description 中的 exact prefix 一致。

### 7.3 自动误匹配后的降级

根加载后重新执行既有第 0 级意图路由。如果请求实际命中窄排除项：

1. 不补齐完整 WorkflowState。
2. 只使用现有最小 route state。
3. 由根创建对应 `SkillRequest`。
4. leaf 以 `Zhanggui Embedded` 执行。
5. 根合并结果后停止，不继续 design/plan 生命周期。

这不是静默成功 fallback：自动根进入已经对用户可见，触发 eval 仍把该次记为 root false positive。运行时降级只防止误匹配进一步放大成本。

### 7.4 多技能冲突

若宿主在同一帧加载根和 leaf：

- 根拥有入口和状态。
- leaf 的 Direct 分支必须被跳过。
- 根需要该 leaf 时重新构造真实 `SkillRequest`，leaf 才走 Embedded 分支。

如果宿主先执行 leaf Direct、之后才加载根，开放标准无法在技能正文中倒转已经发生的顺序。该行为是 host acceptance failure，必须记录并阻断该宿主 profile 的支持声明。

## 8. 错误处理

| 情况 | 行为 |
|---|---|
| 匹配信号不足 | 不自动进入根；交给明确 leaf 或普通处理 |
| 根误匹配窄请求 | 显式告知已进入；最小 route state；Embedded leaf；记录 false positive |
| 根与 leaf 同时加载 | root-first；leaf Direct 禁止执行 |
| 宿主不支持 implicit skill invocation | 保留手动入口；文档标记能力缺失 |
| 宿主不支持声明的手动 alias | 使用宿主原生命令；unsupported probe 不计成功 |
| Codex policy 不被识别 | clean-host smoke 失败；不静默依赖默认值 |
| 目标 leaf 缺失 | 保留现有 `blocked: missing-skill`，不搜索任意目录 |
| description 调整导致 leaf 回退 | 阻断发布；收紧边界并重跑完整 catalog eval |

## 9. Trigger Eval v2

### 9.1 数据模型

v1 按 skill 保存字符串数组，无法分别统计根的显式、隐式和优先级行为。v2 使用带身份的 catalog cases：

```json
{
  "version": 2,
  "runs_per_case": 3,
  "thresholds": {
    "explicit_root_rate": 1.0,
    "implicit_root_rate_gte": 0.8,
    "root_false_positive_rate_lte": 0.1,
    "root_first_conflict_rate": 1.0
  },
  "cases": [
    {
      "id": "root-implicit-cross-module-01",
      "prompt": "...",
      "source": "implicit",
      "expected_skill": "zhanggui",
      "expected_first": "zhanggui",
      "tags": ["root-positive", "cross-module"]
    }
  ]
}
```

每个 case 必须有稳定 `id`，prompt 内容通过 ordered projection SHA-256 固定。transport error 与模型选择错误分开记录；允许最多三波 transport-only retry（backoffs `[0, 5, 15]` 秒），valid wrong selection 永不重试，且 retry 不改原始 rate 分母。

### 9.2 最小覆盖

- 6 个 explicit root positives。
- 至少 8 个 implicit root positives，覆盖 ambiguous、cross-module、multi-deliverable、end-to-end、checkpoint resume 和 migration。
- 至少 12 个 root near-misses，覆盖八个 leaf families 和普通问答。
- 至少 4 个正向冲突：完整生命周期请求包含 bug、TDD、review 或 worktree 子步骤，仍要求 root-first。
- 至少 4 个反向冲突：窄 leaf 请求含 `project`、`complete investigation` 等宽泛词，仍要求对应 leaf。
- 八个 leaf 原有边界案例继续保留，并加入 root exclusion 交叉案例。

### 9.3 发布阈值

- Explicit root selection：`1.0`。
- Implicit high-signal root selection：`>= 0.80`。
- Root false-positive rate：`<= 0.10`。
- Root-first conflict ordering：`1.0`。
- 每个 leaf 的固定基线不得回退。
- 所有结果必须记录 evaluator model、tool、prompt digest、catalog digest、attempt/retry 和 transport errors。

统一 `0.5` 阈值不再适用于重型根。根误触发的用户成本高于 leaf 漏触发，因此负例门更严格。

## 10. TDD 与验证策略

### 10.1 RED

先更新结构测试，使当前 v0.6 以正确原因失败：

- 根不得再包含 `disable-model-invocation`。
- Codex profile 必须允许 implicit invocation。
- plugin/README 不得再声称 explicit-only。
- trigger dataset 必须是 v2，并包含 implicit root cases。
- root-first 和 leaf exclusion 必须有静态合同。
- 官方 validator 必须直接验证根，不能继续先剥离扩展字段。

### 10.2 GREEN

最小修改顺序：

1. 根 frontmatter 和入口模式。
2. Codex profile。
3. 八个 leaf descriptions。
4. trigger v2 数据与测试。
5. plugin metadata、README 和权威设计文档。
6. routing summary 重新生成。

### 10.3 自动验证

- Node 结构和合同测试全绿。
- 官方 `skills-ref validate` 直接验证九个 skill。
- catalog routing eval 完整重跑，不复用 v0.6 rates。
- 结果 summary 的 dataset digest、catalog digest 和当前内容一致。

### 10.4 Clean-host smoke

至少覆盖：

1. 宿主原生命令手动进入根。
2. 无命令的高信号复杂请求自动进入根并告知原因。
3. 无命令的窄 bug 请求进入 systematic-debugging leaf，不进入根。
4. 端到端请求内含 bug/TDD 子步骤时 root-first。
5. 窄 review 或 finishing 请求不进入根。

OMP 继续把 `omp -p "/zhanggui ..."` 作为已知 unsupported alias probe；它不能替代交互式 `/skill:zhanggui` 的手动证据。其他宿主只有实际可运行时才计入 supported totals。

## 11. 文件影响

| 文件/范围 | 变化 |
|---|---|
| `skills/zhanggui/SKILL.md` | strict hybrid frontmatter、入口模式、告知与降级合同 |
| `skills/zhanggui/agents/openai.yaml` | 允许 implicit invocation，更新描述 |
| `skills/zhanggui-*/SKILL.md` | 收紧 root/leaf 互斥 description，不改专业正文 |
| `.codex-plugin/plugin.json` | 版本 0.7.0，改为 hybrid root 表述 |
| `evals/skill-triggering.json` | v2 case schema 与新边界数据 |
| `evals/results/` | 新 v0.7 routing summary，保留 v0.6 历史证据 |
| `tests/` | hybrid、root-first、v2 digest、strict root 合同 |
| `scripts/validate-agent-skills.mjs` | 九个 skill 直接 strict validation |
| `README.md` | 自动/手动使用说明、宿主能力与验证命令 |
| `docs/skill-fusion-design.md` | v0.7 权威架构更新 |

不修改内部 stages、RECOVERY、leaf 的 Direct/Embedded 结果 schema，除非测试证明入口边界必须引用它们。

## 12. 风险与控制

### 12.1 重型根误触发

风险：简单任务进入完整 WorkflowState、设计和计划流程。  
控制：严格 exclusions、`<= 0.10` 负例门、运行时最小状态降级、一次可见告知。

### 12.2 根与 leaf 同时激活

风险：Direct leaf 先产生副作用，根随后重复执行。  
控制：双侧 description 边界、root body guard、冲突 eval、host-first acceptance。不能用开放标准不存在的 priority 字段伪装确定性。

### 12.3 自动根漏触发

风险：用户仍需记住命令。  
控制：高信号正例覆盖、`>= 0.80` 门、README 保留手动入口。不能靠扩大到所有功能请求来换召回率。

### 12.4 宿主策略漂移

风险：同一 collection 在 Claude、Codex、OMP 行为不同。  
控制：标准 frontmatter 为真值；host profile 只适配；每个支持声明必须有 clean-host evidence。

### 12.5 description 过载

风险：九个 descriptions 相互包含过多否定条件，降低 catalog 区分度。  
控制：根集中列 family exclusions；leaf 只写与自身相邻的 root boundary；保持每条描述自包含、具体且低于 1024 字符。

## 13. 被拒绝的方案

### 13.1 根始终自动

优点是入口单一。缺点是窄任务也承担完整编排成本，并削弱独立 leaf 的价值。与选择性 Hybrid 目标冲突。

### 13.2 保持根 manual-only

风险最低，但用户必须知道宿主命令，无法满足“复杂请求自然进入完整流程”的目标。

### 13.3 新增 auto-router skill

增加第十个 skill、第二套路由真值和跨宿主 nested invocation 依赖，重新引入 v0.6 已消除的入口竞争。

### 13.4 默认宿主 hook

可以确定性路由，但 Claude、Codex、OMP 需要分别维护，偏离可移植 collection。只保留为未来可选企业层。

## 14. 完成定义

v0.7 只有同时满足以下条件才完成：

1. 根和八个 leaf 均直接通过官方 strict validator。
2. 根在支持宿主上可手动和选择性自动调用。
3. 窄任务仍进入对应 leaf，不被根普遍抢占。
4. root-first 冲突没有 leaf Direct 先执行。
5. v2 catalog eval 达到全部分项阈值，rates、errors 和 digests 可复核。
6. clean-host smoke 覆盖手动根、隐式根、窄 leaf、正反冲突。
7. README、plugin metadata、设计文档与运行合同一致。
8. 不存在 auto-router、关键词路由、silent fallback 或新增 WorkflowState 入口字段。
