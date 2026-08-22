# Zhanggui Skill 标准化与路由优化设计

**状态：** 已确认，待实施  
**日期：** 2026-07-25  
**目标版本：** v0.6  
**适用范围：** `zhanggui/` plugin collection

## 1. 背景与证据

当前实现已经形成正确的三层结构：一个有状态根编排器、八个可独立闭环的 leaf skills、五个依赖共享状态的内部 stages。

本次标准审计得到以下事实：

- 八个 leaf skills 均通过官方 `skills-ref validate`。
- 根 `zhanggui/SKILL.md` 因顶层宿主扩展字段 `disable-model-invocation` 不通过 strict Agent Skills reference validator。
- `.codex-plugin/plugin.json` 使用 `"skills": "./skills/"`，与成熟 plugin collection 的发现方式一致。
- 当前全部 `SKILL.md` 均少于 500 行，符合 progressive disclosure 的建议上限。
- 当前 16 个结构/合同测试通过，所有相对 `SKILL.md` / `STAGE.md` 路径均存在。
- 当前没有正式的 should-trigger / should-not-trigger eval 数据集，也没有安装后干净会话中的真实 activation event 验收。
- 当前业务流程直接写 sibling `SKILL.md` 相对路径；路径正确，但发现、激活和业务路由耦合在一起。

Agent Skills 开放标准定义技能目录、frontmatter、catalog、activation 与 progressive disclosure，但不定义多技能编排器、WorkflowState、Direct/Embedded 或 return-point 协议。因此 Zhanggui 需要清楚区分“标准技能层”与“宿主编排扩展层”。

## 2. 已确认决策

采用“标准核心 + 宿主编排层”方案：

1. 八个 leaf skills 是 strict Agent Skills。
2. `zhanggui` 根是 host-extended orchestrator，不宣称 strict Agent Skills。
3. 五个依赖 WorkflowState 的 stages 保持内部资源，不参与 discovery。
4. 保留每个 leaf 的 Direct 与 Zhanggui Embedded 两种调用合同。
5. 根统一处理所有 Embedded skill activation；内部 stage 不直接导航 sibling。
6. 激活顺序为 native activation、catalog location、collection sibling fallback。
7. 增加官方 validator、静态合同、正负触发 eval 和干净宿主验收。
8. 不重写八个 leaf 的专业流程，只优化发现、激活、所有权和验证层。

## 3. 目标与非目标

### 3.1 目标

- 保留用户只调用一次 `/zhanggui` 的完整工作流体验。
- 让八个 leaf 在没有根 frame 时真实独立闭环。
- 让根与 stages 通过统一、可观察的合同复用 leaf。
- 避免业务规则依赖硬编码文件层级。
- 对缺失技能、不支持模式、无效输入和宿主能力缺失显式失败。
- 用官方工具和真实宿主事件证明发现与路由，而不是只验证文件存在。

### 3.2 非目标

- 不把 design-assist、grilling、prototype、writing-plans、executing-plans 暴露为 skills。
- 不把 WorkflowState 标准化为 Agent Skills 的一部分。
- 不创建跨宿主生成系统或多套发布产物。
- 不改变 TDD、debugging、verification、review、worktree、parallel 或 finishing 的专业步骤。
- 不要求所有宿主都提供 dedicated skill tool；file-read activation 必须继续可用。

## 4. 分层架构

```text
Host orchestration layer
└── zhanggui
    ├── explicit-only host policy
    ├── WorkflowState / frontier / consensus / return point / readiness owner
    ├── SkillRequest consumer
    └── SkillResult merger

Strict Agent Skills layer
├── zhanggui-systematic-debugging
├── zhanggui-test-driven-development
├── zhanggui-verification-before-completion
├── zhanggui-requesting-code-review
├── zhanggui-receiving-code-review
├── zhanggui-using-git-worktrees
├── zhanggui-dispatching-parallel-agents
└── zhanggui-finishing-a-development-branch

Internal stateful resources
└── zhanggui/stages/
    ├── design-assist
    ├── grilling
    ├── prototype
    ├── writing-plans
    └── executing-plans
```

### 4.1 独立 leaf 判定

一个过程只有同时满足以下条件才可以成为 leaf：

1. 没有 WorkflowState 时，能从用户请求和仓库事实建立输入。
2. 即使需要询问用户，也能在本地处理回答、选择分支、产生终态并结束。

不能满足任一条件的过程保持内部 stage。

### 4.2 调用模式

**Direct**：

- 从用户请求推导本地输入。
- 自己调用宿主提问能力并等待。
- 不创建或伪造 WorkflowState、return point、tracker、readiness、consensus。
- 输出自己的 Completion Contract 后终止。

**Zhanggui Embedded**：

- 只接受根传入的真实字段。
- 需要用户决定时返回 `QuestionRequest`，不直接等待。
- 只返回证据和局部 delta。
- 不改变根拥有的状态字段，不声称整个 effort 完成。

## 5. 合规 Profile

### 5.1 Leaf frontmatter

八个 leaf 只使用 Agent Skills 标准字段：

```yaml
---
name: zhanggui-systematic-debugging
description: Use when ...
---
```

每个 leaf 必须通过：

```text
skills-ref validate skills/<leaf-name>
```

### 5.2 Root frontmatter

根明确采用宿主扩展 profile：

```yaml
---
name: zhanggui
description: Use only when the user explicitly invokes /zhanggui to run the complete stateful development workflow from design through verified delivery
compatibility: Requires a host profile that supports explicit-only invocation and the installed Zhanggui skill collection
disable-model-invocation: true
---
```

约束：

- `description` 自身必须表达 explicit-only，不能只依赖宿主扩展字段。
- `disable-model-invocation` 是唯一允许的非标准顶层字段。
- Codex 继续使用 `agents/openai.yaml` 的 `allow_implicit_invocation: false`。
- 文档统一称根为 “Agent Skills-compatible host extension”，不得称其 strict compliant。

## 6. 统一技能请求合同

### 6.1 SkillRequest

内部 stage 或 Embedded leaf 需要另一个 skill 时，只能返回以下请求：

```yaml
SkillRequest:
  request_id: SR-<stable-id>
  name: zhanggui-systematic-debugging
  mode: zhanggui-embedded
  input:
    symptom: ...
    evidence: ...
  return_to:
    phase: execute
    node: T5
```

字段规则：

- `request_id` 在当前根 frame 内唯一。
- `name` 必须精确匹配已发现 catalog 中的 skill name。
- 内部请求的 `mode` 固定为 `zhanggui-embedded`。
- `input` 只包含目标 leaf 声明的必需字段。
- `return_to` 由根提供；leaf 不自行创建或修改。
- Stage 不读取 sibling `SKILL.md`，只返回 SkillRequest。

### 6.2 SkillResult

```yaml
SkillResult:
  request_id: SR-<stable-id>
  name: zhanggui-systematic-debugging
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: ...
  delta: ...
  question_request: null
  next_skill_request: null
```

字段规则：

- `request_id`、`name`、`mode` 必须与请求一致，否则根拒绝合并。
- `completed` 表示当前 procedure 闭环，不代表整个 effort 完成。
- `awaiting-user` 必须带 `question_request`，由根接管等待。
- `skill-required` 必须带 `next_skill_request`；根处理后恢复当前 procedure。
- `blocked` 必须包含稳定错误码和实际证据。
- `delta` 不得包含对 WorkflowState 所有权字段的直接覆盖。

### 6.3 嵌套请求

- Embedded leaf 不自行激活 sibling；返回 `next_skill_request` 给根。
- 根同步处理子请求，再把结果交回当前 procedure。
- 子请求不占用或覆盖全局 `return_point`。
- 只有需要用户等待时，根才把当前 `request_id` 写入等待上下文，以便恢复。
- 任一时刻只有根维护活动请求链；stage 和 leaf 不维护第二套调用栈。

## 7. 激活算法

根是唯一 Embedded SkillRequest 消费者，按以下顺序处理：

```text
1. Native activation
   宿主提供 Skill / activate_skill，且结果注入当前会话上下文
   -> 根保留 SkillRequest input，在工具调用中只传宿主 schema 支持的精确 name；正文载入当前上下文后，再按保留的 input 执行 Embedded contract

2. Catalog-location activation
   当前技能 catalog 提供目标 SKILL.md 的 location
   -> 读取该绝对 location

3. Collection fallback
   确认运行于完整 Zhanggui collection
   -> 从根 skill directory 解析受控 sibling fallback

4. Failure
   三种方式均不可用
   -> blocked: missing-skill
```

安全和一致性约束：

- Native tool 如果会创建隔离会话且不能返回当前 frame，不用于 Embedded activation。
- 文件加载后校验 frontmatter `name` 与请求名一致。
- Catalog location 或 fallback 必须落在已安装 skills root 内。
- 不搜索任意项目目录、用户主目录或同名未知文件。
- 本会话缓存 `name -> activation method/location`；文件不存在或身份不匹配时清除缓存并 blocked。
- 业务路由表只写 skill name 和 mode，不再把 sibling 路径当成唯一业务接口。

### 7.1 Direct leaf 组合

SkillRequest 只用于 Embedded 路径。Direct leaf 需要另一个 leaf 时，使用宿主的普通技能激活动作和精确 name；宿主没有 dedicated tool 时读取 catalog location。被调用 leaf 仍按 Direct contract 独立结束，不产生或继承 Zhanggui 状态。若依赖是可选能力，调用方使用其已声明的降级；若依赖是完成当前请求的必要条件，则返回 `blocked: missing-skill`。

## 8. 用户提问与状态所有权

```text
Direct leaf
  -> host native question if available
  -> text fallback with explicit reason
  -> leaf owns local wait and terminal outcome

Embedded leaf
  -> SkillResult(status=awaiting-user, question_request=...)
  -> root validates QuestionRequest
  -> root updates WorkflowState.awaiting and checkpoint
  -> root performs real native question call or explicit text fallback
  -> root resumes the same request_id
```

根拒绝以下 delta：

- leaf 设置最终 readiness。
- leaf 覆盖 WorkflowState.return_point。
- leaf 直接修改 tracker 行或 parent/child status。
- leaf 私自改变 owner、consensus 或全局 phase。
- `awaiting-user` 没有 QuestionRequest。

## 9. 失败合同

| 错误码 | 条件 | 结果 |
|---|---|---|
| `missing-skill` | catalog、native tool、fallback 都找不到目标 | blocked，报告请求名与已尝试方式 |
| `skill-identity-mismatch` | 载入文件的 frontmatter name 不匹配 | blocked，不执行正文 |
| `unsupported-mode` | leaf 没有 Embedded 合同 | blocked，不退化为 Direct |
| `invalid-embedded-input` | 缺少 leaf 必需输入 | blocked，列出缺失字段 |
| `invalid-skill-result` | request identity 或状态 schema 不合法 | 拒绝合并，保留原 frame |
| `state-ownership-violation` | delta 写入根专属字段 | 拒绝合并并报告字段 |
| `no-native-question-tool` | 宿主没有结构化提问工具 | 明确 text fallback reason |
| `unsupported-question-shape` | 工具 schema 无法忠实表达问题 | 明确 text fallback reason |

任何错误都不得静默跳过 skill、假装 procedure 已完成或切换到另一个同名文件。

## 10. 迁移范围

### 10.1 Root

更新 `skills/zhanggui/SKILL.md`：

- 收窄 description，增加 compatibility。
- 新增 SkillRequest、SkillResult、activation 与 merge contract。
- Stage 导航表改为 skill name + Embedded mode。
- sibling 文件路径移入受控 fallback registry。
- 删除任意目录搜索作为正常加载路径；只保留已安装 collection 的确定性 fallback。

### 10.2 Internal stages

更新 `executing-plans/STAGE.md` 及其他需要 leaf 的 stage：

- 不再直接读取 sibling SKILL.md。
- 返回 SkillRequest 给根。
- 保留原任务状态和 return target。

### 10.3 Leaves

- 保留 Direct/Embedded 专业流程。
- Embedded 依赖 sibling 时返回 `next_skill_request`。
- Direct 依赖 sibling 时按标准 activation action 使用精确 name；缺少能力时使用该流程已声明的降级或 blocked。
- 删除业务正文中的硬编码 sibling SKILL.md 路径。
- 本地参考文件仍相对当前 leaf root 加载。

### 10.4 Plugin 与文档

- Manifest 版本更新到 v0.6。
- README 和权威设计文档记录 strict leaves / host-extended root 的边界。
- 安装单元仍是完整 collection。
- 文档列出 native、catalog-location、fallback 三种 activation。

## 11. 验证设计

### 11.1 官方规范验证

- 八个 leaf 全部执行 `skills-ref validate`，任何 warning/error 都失败。
- 根使用单独检查：标准字段必须合法，额外字段集合必须精确等于 `{disable-model-invocation}`。
- 根出现第二个未知顶层字段即失败。

### 11.2 静态合同测试

覆盖：

- 精确九技能 catalog。
- 根 explicit-only description 与宿主 policy。
- 五个 stateful stages 不参与 discovery。
- SkillRequest 只能由根消费。
- Stage 不含直接 sibling SKILL.md 加载。
- Embedded leaf 不含根状态写入权。
- fallback registry 的每个目标存在且身份匹配。
- Direct 和 Embedded 均有 completion/result contract。
- 非法结果和 ownership violation 被拒绝。

### 11.3 触发 eval

为根和每个 leaf 保存版本化 trigger dataset：

- 每个 leaf 至少 6 个 should-trigger。
- 每个 leaf 至少 6 个 near-miss should-not-trigger。
- 相邻边界必须双向覆盖：debugging/TDD、requesting/receiving review、worktree/finishing、parallel/debugging。
- 根包含显式 `/zhanggui` 正例，以及普通 idea/bug/review 的反例。
- 每条查询至少运行 3 次，记录 trigger rate。
- should-trigger rate 必须大于 0.5；should-not-trigger rate 必须小于 0.5。
- 调整 description 时固定 train/validation split，禁止只针对失败措辞追加关键词。

### 11.4 干净宿主验收

至少在当前目标宿主完成以下新会话场景并保留 activation event/transcript：

1. 显式 `/zhanggui` 加载根，不隐式加载竞争 leaf。
2. 普通 bug 请求只加载 debugging leaf。
3. 生产行为实现请求加载 TDD leaf，不加载根。
4. 外部 review feedback 加载 receiving，不加载 requesting。
5. 根执行中的 Embedded 请求由 native activation 完成。
6. 禁用 native skill tool 后，同一请求通过 catalog location 或受控 fallback 完成。
7. Embedded QuestionRequest 由根记录 awaiting 后真实分发。
8. 缺失 leaf 时得到 `blocked: missing-skill`，原 WorkflowState 未损坏。

## 12. 验收标准

实施完成必须同时满足：

- 八个 leaf 通过官方 validator。
- 根只有一个已记录的非标准扩展字段。
- 根 description 明确 explicit-only。
- 所有 Embedded 激活经过 SkillRequest。
- Internal stages 不直接读取 sibling skill。
- Native activation 与 file-read fallback 均有证据。
- 所有 SkillResult 经过 identity、schema 和 ownership 校验。
- 正负触发 eval 达到阈值。
- 干净宿主验收场景全部通过。
- 原有 16 个结构/安全测试保持通过。
- 八个 leaf 的 Direct 行为和原专业流程没有回归。

## 13. 最终合规表述

实施后统一使用以下表述：

> Zhanggui 提供八个严格符合 Agent Skills specification 的可独立技能，以及一个采用宿主 explicit-only 扩展的兼容编排器。技能发现和激活遵循 Agent Skills progressive disclosure；Direct/Embedded、WorkflowState 与 SkillRequest 是 Zhanggui collection 的内部编排协议。
