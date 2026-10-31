---
name: zhanggui-verification-before-completion
license: MIT
description: Proves a completion claim with fresh evidence — real command output, test results, an actual run — before anyone acts on that claim. Use when work is about to be called done, fixed, passing, or ready, when a commit, push, or handoff is about to rest on it, when someone wants the actual command output rather than a summary, when an earlier 已修复 or 通过 claim has to be re-checked, or when the change looks small and safe and still needs evidence instead of a feeling.
---

# Verification Before Completion

## Invocation Modes

### Direct

Use this mode when the skill is activated from the catalog or invoked explicitly. Establish the `Claim` and its `Acceptance` criteria from the request, plan, or observable contract, then gather fresh evidence. Do not require or invent `WorkflowState`, `return_point`, `ReturnPhase`, `ReturnNode`, or readiness.

```text
Claim: 要声称的状态
Evidence: 实际运行的命令/场景、exit code 和关键结果
Coverage: 覆盖到的验收条件
Gaps: 未验证或失败项
Outcome: verified | not-verified
```

`verified` allows the evidence-backed claim. `not-verified` reports the actual state and gaps, then ends this invocation without pretending another phase will resume it.

When the user has explicitly declined verification for this step, name the evidence that is missing once and stop; do not run the procedure over their decision. When the user reports that verification already passed and asks to integrate the branch, `zhanggui-finishing-a-development-branch` owns the verification prerequisite for that decision.

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-verification-before-completion
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <Claim/Evidence/Coverage/Gaps 实际证据-or-null>
  delta:
    Claim: 要声称的状态
    Evidence: 实际运行的命令/场景、exit code 和关键结果
    Coverage: 覆盖到的验收条件
    Gaps: 未验证或失败项
    ReturnPhase: 原阶段
    ReturnNode: 原 decision/prototype/task/validation id
    StageStatus: verified | not-verified
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null>
```

Use this mode only when `/zhanggui` supplies `Claim`, `Acceptance`, current `Evidence`, and a saved `return_point` containing `ReturnPhase` and `ReturnNode`.

Preserve the supplied return fields unchanged inside `delta`. On `delta.StageStatus: verified`, `/zhanggui` may make the claim and clear the return point. On `not-verified`, `/zhanggui` merges `Gaps`, clears the detour slot, and restores the original work. This skill never routes, clears state, or expands verification beyond `Acceptance`.


验证纪律的唯一维护处是 [`../zhanggui/stages/executing-plans/references/verification.md`](../zhanggui/stages/executing-plans/references/verification.md)：IDENTIFY/RUN/READ/VERIFY 循环、声称与所需证据对照表、禁止措辞与红旗、何时必须应用。本技能只提供调用契约，不复述纪律。

