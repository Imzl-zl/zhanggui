---
name: zhanggui-requesting-code-review
description: Use when a code change needs independent review before verification, merge, delivery, or continuing dependent work
---

# Requesting Code Review

## Invocation Modes

### Direct

Use this mode when the skill is activated from the catalog or invoked explicitly. Determine `Scope` from the requested `BASE..HEAD` range or current working-tree diff. Use an explicit plan, requirements, or user-stated criteria as `Contract`; when none exists, review the quality axis and mark plan alignment as unchecked instead of inventing a contract.

The review is read-only and ends with a human-facing report. Do not mutate the checkout, create tracker rows, invent `ReturnPhase`/`ReturnNode`, set readiness, or claim verification.

### Zhanggui Embedded

Use this mode only when `/zhanggui` supplies:

```text
Scope: BASE_SHA..HEAD_SHA 或明确 diff 范围
Contract: SPEC/decisions/task goal+boundary
Trigger: completion-gate | per-task | ad-hoc | pre-merge
ReturnPhase / ReturnNode: 从 execution 调用时提供
```

This is a synchronous procedure, not a detour. Preserve supplied return fields, do not write `WorkflowState.return_point`, and leave `awaiting` and global readiness unchanged.

## When to Review

Required before verification when changes involve security, migrations, public interfaces, existing data, multiple files, an Epic child boundary, merge/delivery, or an explicit review request.

A single-file low-risk change, documentation-only edit, or throwaway prototype may skip review only when `/zhanggui` records the reason. Direct mode does not create such notes; it simply runs when invoked.

## Review Workflow

1. Resolve the exact git range or working-tree diff and state it.
2. Resolve the review contract. If absent in Direct mode, mark the fidelity axis unchecked.
3. If subagents are available, dispatch one independent reviewer using [code-reviewer.md](code-reviewer.md):
   - `DESCRIPTION` = concise implementation summary.
   - `PLAN_OR_REQUIREMENTS` = the actual contract, or `not provided - quality review only`.
   - `BASE_SHA` / `HEAD_SHA` = the resolved range.
4. Without subagents, read the complete diff and apply the same two axes:
   - **Fidelity:** implementation matches the supplied requirements; deviations are identified.
   - **Quality:** correctness, error handling, edge cases, security, real-behavior tests, migrations, compatibility, and production readiness.
5. Keep review read-only. Never mutate the working tree, index, HEAD, or branch.
6. Categorize every issue by actual severity and cite `file:line`, impact, and a concrete fix.

## Findings Semantics

- **Critical:** bugs, security flaws, data loss, or broken behavior.
- **Important:** missing behavior, architecture defects, poor error handling, or material test gaps.
- **Minor:** style, optimization, or documentation polish.
- **Plan defect:** identify it explicitly; do not redesign inside the review.
- **Incorrect reviewer claim:** rebut it with code, tests, or build evidence rather than accepting it performatively.

All severities are report-only in this skill. In Embedded mode, emit the findings and `StageStatus`; `/zhanggui` or the execution loop decides which tasks to reopen, what notes to record, whether design drift applies, and when verification may begin.

A passed review is not completion verification. Fresh verification remains mandatory.

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
Scope: 实际审查范围
Strengths: 做得好的具体点
Findings: [{severity: critical|important|minor, file:line, what, why, fix}]
ReturnPhase / ReturnNode: 原样返回（若调用方提供）
StageStatus: review-passed | fixes-required | blocked
```

`/zhanggui` owns task reopening, design-drift routing, notes, and the transition to verification.
