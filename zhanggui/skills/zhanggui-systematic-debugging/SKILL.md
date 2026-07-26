---
name: zhanggui-systematic-debugging
description: Use when encountering a bug, test failure, build failure, performance problem, or unexpected behavior before proposing or implementing a fix
---

# Systematic Debugging

## Invocation Modes

### Direct

Use this mode when the skill is activated from the catalog or invoked explicitly. Establish `Symptom` and `Evidence` from the request, repository, environment, and a reproducible run. Do not require or invent `WorkflowState`, `ReturnPhase`, `ReturnNode`, or global `Readiness`.

Run the four phases through a standalone outcome. `resolved`, `blocked`, and `architecture-review-required` are terminal results for this invocation; do not pretend another router will resume the work.

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-systematic-debugging
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <actual procedure evidence-or-null>
  delta: <existing procedure-specific output fields-or-null>
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null>
```

Use this mode only when `/zhanggui` loads this file as a supporting procedure and supplies:

```text
Symptom: 可复现的失败
Evidence: 命令、输出、stack trace 或观察
ReturnPhase: route | discovery | design | prototype | execute | verify
ReturnNode: decision id | prototype parent id | task id | validation id
```

Preserve `ReturnPhase` and `ReturnNode` unchanged in the output delta. Debug does not set global `Readiness`: design/prototype failures return to the original decision node, execution failures return to the original task, and a top-level bug uses `ReturnPhase: route` with an empty `ReturnNode`. The Zhanggui frame, not this skill, resumes routing.

## 核心原则

**随机修复浪费时间、制造新 bug。先根因调查，再修复。**

- 推荐：任何 bug 都走 4 阶段流程
- 强制：**3 次修复失败后必须停下质疑架构**（不试第 4 次）
- 不强制：简单 bug 也可走流程，但可快速通过

## 适用场景

- 测试失败
- 生产 bug
- 异常行为
- 性能问题
- 构建失败
- 集成问题

多个互不相关的失败可并行调查，每个失败域一个 agent：
- Direct mode: activate the exact leaf name `zhanggui-dispatching-parallel-agents` through the host catalog; if the optional parallel capability is unavailable, execute serially and say so.
- Embedded mode: return `SkillResult.status=skill-required` with `next_skill_request` set to the exact leaf; do not load sibling files directly.

```text
next_skill_request:
  name: zhanggui-dispatching-parallel-agents
  mode: zhanggui-embedded
```

**特别推荐**：
- 时间压力下（紧急时猜测诱人但更慢）
- "就一个小修复"看似明显时
- 已尝试多次修复未果
- 上次修复无效
- 不完全理解问题

## 4 阶段流程

### Phase 1：根因调查

**修复前必须做**：

1. **仔细读错误信息**
   - 不跳过 error/warning
   - 错误信息常含解法
   - 完整读 stack trace
   - 记下行号、文件路径、错误码

2. **稳定复现**
   - 能可靠触发吗？
   - 精确步骤是什么？
   - 每次都发生吗？
   - 不能复现 → 收集更多数据，不猜

3. **检查最近改动**
   - 什么改动可能引起？
   - git diff、最近 commit
   - 新依赖、配置改动
   - 环境差异

4. **多组件系统收集证据**

   多组件系统（CI → build → signing，API → service → database）：

   ```
   对每个组件边界：
     - 记录进入组件的数据
     - 记录离开组件的数据
     - 验证环境/配置传递
     - 检查每层状态

   运行一次收集证据，显示 WHERE 出问题
   然后分析证据定位失败组件
   然后调查该组件
   ```

5. **追踪数据流**

   错误深在调用栈时：
   - 错误值从哪起源？
   - 谁用错误值调用了这里？
   - 持续向上追直到源头
   - 在源头修，不在症状修

   详见 `root-cause-tracing.md`

### Phase 2：模式分析

**修复前找模式**：

1. **找工作的例子**
   - 同代码库中类似的工作代码
   - 什么工作的东西类似坏掉的？

2. **对比参考实现**
   - 实现模式时，完整读参考实现（不 skim）
   - 完全理解模式再应用

3. **识别差异**
   - 工作 vs 坏掉的有什么不同？
   - 列出每个差异，无论多小
   - 不假设"那不重要"

4. **理解依赖**
   - 需要哪些组件/配置/环境？
   - 做了哪些假设？

### Phase 3：假设与测试

**科学方法**：

1. **形成单一假设**
   - 明确陈述："我认为 X 是根因，因为 Y"
   - 写下来
   - 具体，不含糊

2. **最小化测试**
   - 最小改动测试假设
   - 一次一个变量
   - 不一次修多个

3. **验证后再继续**
   - 工作了？→ Phase 4
   - 没工作？→ 形成新假设
   - 不叠加更多修复

4. **不知道时**
   - 说"我不懂 X"
   - 不假装知道
   - 求助、研究

永久生产 bug fix 在 Phase 4 写实现前必须走 TDD；先让回归测试以正确原因失败，再修根因。用于调查的临时 probe 不等于生产实现。
- Direct mode: activate the exact leaf name `zhanggui-test-driven-development` through the host catalog; TDD is required for production bug fix implementation and blocks if unavailable.
- Embedded mode: return `SkillResult.status=skill-required` with `next_skill_request` set to the exact leaf; do not load sibling files directly.

```text
next_skill_request:
  name: zhanggui-test-driven-development
  mode: zhanggui-embedded
```

### Phase 4：实现

**修根因，不修症状**：

1. **创建失败测试用例**
   - 最简复现
   - 自动化测试（如有框架）
   - 一次性脚本（如无框架）
   - 修复前必须有

2. **实现单一修复**
   - 修已识别的根因
   - 一次一个改动
   - 不"顺手"改进
   - 不捆绑重构

3. **验证修复**
   - 测试现在通过？
   - 没破坏其他测试？
   - 问题真的解决了？

4. **修复无效时**
   - 停下
   - 计数：试了几次修复？
   - < 3 次：回 Phase 1，用新信息重新分析
   - **≥ 3 次：停下质疑架构（步骤 5）**
   - **不试第 4 次修复，先质疑架构**

5. **3+ 次失败：质疑架构**

   **架构问题的信号**：
   - 每次修复揭示新的共享状态/耦合/问题
   - 修复需要"大规模重构"才能实现
   - 每次修复在他处制造新症状

   **停下质疑根本**：
   - 这个模式根本上合理吗？
   - 我们是否"凭惯性坚持"？
   - 该重构架构 vs 继续修症状？

   **与用户讨论后再尝试更多修复**。

   这不是假设失败 - 这是架构错误。

## Common Rationalizations（合理化识别）

| 合理化 | 现实 |
|---|---|
| "我快速修一下" | 不找根因的快速修复制造新 bug。 |
| "错误信息很明显" | 看着明显的错误也需要完整调查。 |
| "我见过这个" | 相似症状可能有不同根因。 |
| "我就改这一处" | 不理解的改动可能级联。 |
| "修复很简单" | 误解问题的简单修复会失败。 |
| "不用读完整 stack trace" | Stack trace 含根因位置。 |
| "可以跳过复现" | 不能复现就不能验证修复。 |
| "这只是竞态条件" | 竞态条件也有原因。找到它。 |

## Red Flags

**思考这些时停下回 Phase 1**：

- "先快速修，后调查"
- "试试改 X 看看"
- "加多个改动，跑测试"
- "跳过测试，手动验证"
- "可能是 X，修一下"
- "不完全懂但可能行"
- 提出方案前未追踪数据流
- **"再试一次修复"（已试 2+ 次）**
- **每次修复揭示新地方的问**

**3+ 次修复失败**：质疑架构（Phase 4.5）

## 快速参考

| Phase | 关键活动 | 成功标准 |
|---|---|---|
| 1. 根因 | 读错/复现/查改动/收证据 | 理解 WHAT 和 WHY |
| 2. 模式 | 找工作例子/对比 | 识别差异 |
| 3. 假设 | 形成理论/最小测试 | 假设确认或新假设 |
| 4. 实现 | 创建测试/修/验证 | bug 解决，测试通过 |

## "无根因"情况

系统调查揭示问题确为环境/时序/外部：

1. 已完成流程
2. 记录调查了什么
3. 实现适当处理（retry/timeout/error message）
4. 加监控/日志供未来调查

**但**：95% 的"无根因"是调查不完整。

## 辅助技术（同目录）

- `root-cause-tracing.md`：调用栈反向追踪
- `defense-in-depth.md`：多层验证
- `condition-based-waiting.md`：条件轮询替代任意 timeout

## Completion Contracts

### Direct

```text
RootCause: 已证实的根因和证据
Change: 修复或设计事实；未修改时明确写 none
Validation: 新鲜命令/场景及结果
Outcome: resolved | blocked | architecture-review-required
```

报告实际结果后结束本次调用。没有编排 frame 时不得输出或伪造 `ReturnPhase`、`ReturnNode`。

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-systematic-debugging
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <RootCause/Change/Validation 实际证据-or-null>
  delta:
    RootCause: 已证实的根因和证据
    Change: 修复或设计事实；未修改时明确写 none
    Validation: 新鲜命令/场景及结果
    ReturnPhase: 原阶段
    ReturnNode: 原 decision/prototype/task/validation id
    StageStatus: resolved | blocked | architecture-review-required
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null；parallel 用 zhanggui-dispatching-parallel-agents，生产 bugfix 实现前用 zhanggui-test-driven-development>
```

`status: completed` with `delta.StageStatus: resolved` 只表示本次 debug 闭环；`/zhanggui` 必须回到 `ReturnPhase` 继续原流程。本 skill 不自行切换 phase、清空 return point 或设置 readiness。`skill-required` 时由根同步处理 `next_skill_request` 后恢复本 procedure。
