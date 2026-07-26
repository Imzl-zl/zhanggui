---
name: zhanggui-receiving-code-review
description: Use when receiving code review feedback before accepting, rejecting, or implementing reviewer suggestions
---

# Receiving Code Review Feedback

## Invocation Modes

### Direct

Use this mode when the skill is activated from the catalog or invoked explicitly. Read the complete feedback and verify it against the current codebase before responding or editing. Do not invent `WorkflowState`, tracker rows, consensus recap state, `ReturnPhase`, `ReturnNode`, or readiness.

When feedback conflicts with a known user-owned architectural decision, identify the exact conflict and ask the user to resolve it. Do not simulate a Zhanggui recap. Direct mode completes with a human-facing technical resolution.

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

## Feedback Workflow

```text
1. READ: read all feedback before reacting
2. UNDERSTAND: restate the requirement or ask a precise question
3. VERIFY: check the suggestion against repository reality
4. EVALUATE: decide whether it is technically correct here
5. RESPOND: acknowledge technically or rebut with evidence
6. IMPLEMENT: handle one accepted item at a time and verify it
```

## Rules

- If any item is unclear, pause all implementation and clarify first. Related items make partial understanding unsafe.
- Implement clear items in order: crash/security blockers, simple fixes, then complex fixes. Verify each item and check for regressions.
- Push back when a suggestion breaks working behavior, lacks necessary context, violates YAGNI, is wrong for this stack, or conflicts with a recorded user decision.
- Ground pushback in code, references, tests, or build evidence.
- Do not perform agreement: avoid praise, gratitude, or "You're absolutely right". Correct feedback is acknowledged by a concise technical statement and the verified change.
- If your pushback was wrong, correct the fact directly without a long apology or defense.

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
