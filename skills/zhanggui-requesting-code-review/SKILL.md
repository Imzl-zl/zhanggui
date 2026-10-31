---
name: zhanggui-requesting-code-review
license: MIT
description: Runs a new independent review of a diff, patch, or set of changed files and reports Critical and Important findings by severity. Use when someone asks for a review, 审查, 过一遍, or 独立评审 of a diff, patch, 改动, or 公共接口, asks whether a change has 坑 or 安全问题, wants a written 审查报告 for a pull request, wants only reviewing with no edit to the code, or needs a one-line change, a three-file refactor, or a release script about to go live checked by someone else.
---

# Requesting Code Review

## Invocation Modes

### Direct

Use this mode when the skill is activated from the catalog or invoked explicitly. Determine `Scope` from the requested `BASE..HEAD` range or current working-tree diff. Use an explicit plan, requirements, or user-stated criteria as `Contract`; when none exists, review the quality axis and mark plan alignment as unchecked instead of inventing a contract.

The review is read-only and ends with a human-facing report. Do not mutate the checkout, create tracker rows, invent `ReturnPhase`/`ReturnNode`, set readiness, or claim verification.

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-requesting-code-review
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <actual procedure evidence-or-null>
  delta: <existing procedure-specific output fields-or-null>
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null>
```

Use this mode only when `/zhanggui` supplies:

```text
Scope: BASE_SHA..HEAD_SHA 或明确 diff 范围
Contract: SPEC/decisions/task goal+boundary
Trigger: completion-gate | per-task | ad-hoc | pre-merge
ReturnPhase / ReturnNode: 从 execution 调用时提供
```

This is a synchronous procedure, not a detour. Preserve supplied return fields inside `delta`, do not write `WorkflowState.return_point`, and leave `awaiting` and global readiness unchanged.


审查纪律的唯一维护处是 [`../zhanggui/stages/executing-plans/references/code-review.md`](../zhanggui/stages/executing-plans/references/code-review.md)：何时必须审、只读流程、architecture 与 detail 分类、级别语义、报告形状。审查者提示词在同目录 `code-reviewer.md`。本技能只提供调用契约，不复述纪律。

## Completion Contracts

### Direct

```text
Scope: 实际审查范围
ContractCoverage: checked | unchecked
Strengths: 做得好的具体点
Findings: [{severity, file:line, what, why, fix}]
Assessment: ready | ready-with-minor-notes | fixes-required | blocked
```

Return the report and stop. Do not implement findings in this skill.

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-requesting-code-review
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <Scope/Strengths/Findings 实际证据-or-null>
  delta:
    Scope: 实际审查范围
    Strengths: 做得好的具体点
    Findings: [{severity: critical|important|minor, file:line, what, why, fix}]
    ReturnPhase / ReturnNode: 原样返回（若调用方提供）
    StageStatus: review-passed | fixes-required | blocked
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null>
```

`/zhanggui` owns task reopening, design-drift routing, notes, and the transition to verification.
