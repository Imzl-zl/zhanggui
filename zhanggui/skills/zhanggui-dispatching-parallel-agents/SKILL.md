---
name: zhanggui-dispatching-parallel-agents
description: Use when two or more independent problem domains can run concurrently without shared state or overlapping writes; defer to the zhanggui root when parallel work belongs to an explicit, cross-module, or end-to-end workflow
---

# Dispatching Parallel Agents

## Invocation Modes

### Direct

Use this mode when the skill is activated from the catalog or invoked explicitly. Partition the requested work, dispatch independent domains, verify real diffs/results, integrate them, and finish with a local report. Do not create or invent `WorkflowState`, CSV tracker rows, parent/child status, return points, or readiness.

When the host has no subagent capability, execute the same domains serially and say that parallel dispatch was unavailable.

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-dispatching-parallel-agents
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <actual procedure evidence-or-null>
  delta: <existing procedure-specific output fields-or-null>
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null>
```

Use this mode only when `/zhanggui` supplies dependency-ready tasks or failures with explicit boundaries. Agents never own `WorkflowState` or tracker status. Return verified results to the current execute/debug frame; `/zhanggui` alone updates rows and recomputes parent/child status.

## Core Principle

One independent problem domain per agent. Give each agent exactly the context it needs; never make it inherit ambient session history.

## When to Use

Use parallel dispatch when:

- Two or more failures have different suspected root causes and can be understood independently.
- Epic children have satisfied dependencies and non-overlapping write scopes.
- Each domain can be validated without another domain's intermediate state.

Do not parallelize when failures may share one cause, system-wide state is needed, files/resources overlap, or ordering matters. When independence is uncertain, investigate first instead of guessing.

## Dispatch Pattern

1. Partition work by what is independently broken or deliverable.
2. Give each agent a self-contained task containing:
   - exact scope or goal/boundary;
   - full error/test/context evidence;
   - explicit constraints and non-goals;
   - expected output and validation responsibility.
3. Dispatch all independent agents in one tool message. One dispatch per message is serial, not parallel.
4. When write scopes may touch adjacent areas, isolate each writer through exact catalog composition:
   - Direct mode: activate the exact leaf name `zhanggui-using-git-worktrees` through the host catalog; if the optional worktree capability is unavailable, fall back to non-overlapping scopes or serialize and say so.
   - Embedded mode: return `SkillResult.status=skill-required` with `next_skill_request` set to the exact leaf; do not load sibling files directly.

```text
next_skill_request:
  name: zhanggui-using-git-worktrees
  mode: zhanggui-embedded
```

Bad: "fix all the tests". Good: "investigate these three failures in `agent-tool-abort.test.ts`; do not add timeouts or edit production code; return one proven root cause."

## Collect and Integrate

For every result:

1. Read the report and understand the claimed change.
2. Inspect the actual VCS diff or output. An agent saying "success" is not evidence.
3. Detect same-location or semantic conflicts before combining work.
4. Run each domain's focused validation, then the integrated complete suite or smoke scenario.
5. For high-risk domains, request independent review through exact catalog composition:
   - Direct mode: activate the exact leaf name `zhanggui-requesting-code-review` through the host catalog; if the optional review capability is unavailable, record the skip/fallback and continue with integrated validation evidence.
   - Embedded mode: return `SkillResult.status=skill-required` with `next_skill_request` set to the exact leaf; do not load sibling files directly.

```text
next_skill_request:
  name: zhanggui-requesting-code-review
  mode: zhanggui-embedded
```

Direct mode records integration in its report only. Embedded mode returns evidence; `/zhanggui` updates tracker rows after verification and derives parent status from child truth.

## Completion Contracts

### Direct

```text
DispatchPlan: 域划分与每个 agent 的 scope
AgentResults: 每个 agent 的摘要 + 实际 diff/结果核实
Conflicts: 冲突及处理
Validation: 各域和集成后的新鲜结果
Outcome: integrated | conflicts-found | blocked | serial-fallback
```

Report the integrated result and stop without tracker or routing fields.

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-dispatching-parallel-agents
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <DispatchPlan/AgentResults/Conflicts/Validation 实际证据-or-null>
  delta:
    DispatchPlan: 域划分与每个 agent 的 scope
    AgentResults: 每个 agent 的摘要 + 实际 diff/结果核实
    Conflicts: 冲突及处理
    Validation: 各域和集成后的新鲜结果
    StageStatus: integrated | conflicts-found | blocked | serial-fallback
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null；isolation 用 zhanggui-using-git-worktrees，高风险审查用 zhanggui-requesting-code-review>
```

This skill does not set readiness or mark tasks complete. `/zhanggui` merges the delta into the original frame and completion claims still require verification. `skill-required` is handled by the root through `next_skill_request`, then this procedure resumes.
