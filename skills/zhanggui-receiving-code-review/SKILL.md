---
name: zhanggui-receiving-code-review
license: MIT
description: Verifies incoming review feedback item by item and gives each one an explicit disposition — accepted, rejected with evidence, or implemented. Use when review feedback, reviewer comments, or a 审查报告 has arrived and each 条 needs technical checking before it is accepted or pushed back, including when a 同事 claims the implementation is wrong, when a 上一轮审查 left 结论 still unresolved, and when someone wants to know 哪条真的成立 instead of accepting it performatively.
---

# Receiving Code Review Feedback

## Invocation Modes

### Direct

Use this mode when the skill is activated from the catalog or invoked explicitly. Read the complete feedback and verify it against the current codebase before responding or editing. Do not invent `WorkflowState`, tracker rows, consensus recap state, `ReturnPhase`, `ReturnNode`, or readiness.

When feedback conflicts with a known user-owned architectural decision, identify the exact conflict and ask the user to resolve it. Do not simulate a Zhanggui recap. Direct mode completes with a human-facing technical resolution.

This skill handles feedback that already exists. Producing a new review of a diff or code change belongs to `zhanggui-requesting-code-review`.

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-receiving-code-review
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <actual procedure evidence-or-null>
  delta: <existing procedure-specific output fields-or-null>
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null>
```

Use this mode only when `/zhanggui` supplies:

```text
Feedback: 完整审查意见
Context: 当前代码、约束和已确认设计
ReturnPhase / ReturnNode: 从 execution 调用时提供
```

This is a synchronous procedure, not a detour. Preserve supplied return fields inside `delta`, do not write `WorkflowState.return_point`, and leave `awaiting` and readiness unchanged. If feedback conflicts with an `owner:user` decision, return the conflict as `blocked`; `/zhanggui` owns recap and design changes.


反馈处理纪律的唯一维护处是 [`../zhanggui/stages/executing-plans/references/receiving-feedback.md`](../zhanggui/stages/executing-plans/references/receiving-feedback.md)：READ/VERIFY/EVALUATE/RESPOND/IMPLEMENT 循环、反驳规则、不表演式同意。本技能只提供调用契约，不复述纪律。

## Completion Contracts

### Direct

```text
Clarifications: 仍需解释的条目
Accepted: 核实正确的反馈及理由
Rejected: 有证据反驳的反馈及理由
Changes: 已完成的逐项改动
Validation: 每项改动的新鲜验证
Outcome: feedback-resolved | blocked
```

Return the technical resolution and stop without routing fields.

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-receiving-code-review
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <Clarifications/Accepted/Rejected/Changes/Validation 实际证据-or-null>
  delta:
    Clarifications: 仍需用户/审查者解释的条目
    Accepted: 核实正确的反馈及理由
    Rejected: 有证据反驳的反馈及理由
    Changes: 已完成的逐项改动
    Validation: 每项改动的新鲜验证
    ReturnPhase / ReturnNode: 原样返回
    StageStatus: feedback-resolved | changes-required | blocked
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null>
```

This skill does not set readiness or privately change user-owned decisions. `/zhanggui` owns task state and subsequent routing.
