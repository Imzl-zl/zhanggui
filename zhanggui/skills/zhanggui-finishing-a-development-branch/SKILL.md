---
name: zhanggui-finishing-a-development-branch
description: Use when verified work on a branch or worktree needs an explicit decision to merge, push and open a PR, keep, or discard it
---

# Finishing a Development Branch

## Invocation Modes

### Direct

Use this mode when the skill is activated from the catalog or invoked explicitly. Require fresh evidence that the work is verified before presenting any integration option. When evidence is missing or stale, Direct mode: activate the exact leaf name `zhanggui-verification-before-completion` through the host catalog; verification is required and blocks if unavailable. Do not invent a verified state.

Direct mode owns no `WorkflowState`, `awaiting`, `Delivery`, return point, or readiness. Deliver choices through the host's structured ask capability when available. Otherwise state an explicit text-fallback reason and ask once in text.

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-finishing-a-development-branch
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <actual procedure evidence-or-null>
  delta: <existing procedure-specific output fields-or-null>
  question_request: <QuestionRequest-or-null>
  next_skill_request: <SkillRequest-or-null>
```

Use this mode only when `/zhanggui` supplies `Verified: verified` plus current branch/workspace state. If verification is not current and verified, return `SkillResult.status=skill-required` with `next_skill_request` set to the exact leaf; do not invent a verified state and do not load sibling files directly.

```text
next_skill_request:
  name: zhanggui-verification-before-completion
  mode: zhanggui-embedded
```

Construct the `QuestionRequest`, but before waiting let `/zhanggui` update its shared awaiting state and deliver the question through the root native-question contract. This skill returns only the selected action delta and never sets readiness.

## Step 1: Detect Workspace State

Inspect git dir/common dir, current branch, detached state, worktree path, remotes, and the repository's PR workflow.

| State | Choices | Cleanup ownership |
|---|---|---|
| Normal checkout | Standard four | No worktree cleanup |
| Named-branch worktree | Standard four | Determined by path ownership |
| Detached worktree | `push-pr`, `keep`, `discard` | Externally managed; do not remove |

## Step 2: Resolve Base Branch

Use repository configuration and merge-base evidence to identify `main`, `master`, or another actual base. When ambiguous, ask one structured base-branch question. Direct mode dispatches it itself; Embedded mode hands it to the root frame after awaiting state is updated.

## Step 3: Choose an Action

If the user already gave an unambiguous action, normalize it to a stable id and skip the menu. Otherwise construct:

```yaml
QuestionRequest:
  id: finishing-choice
  question: 实现已验证，接下来如何处理？
  context: 当前分支 <feature>，目标分支 <base-branch>
  options:
    - { id: local-merge, label: 本地合并, description: 合并回 <base-branch> 并在合并结果上重跑验证 }
    - { id: push-pr, label: Push 并创建 PR, description: 推送 <feature>、实际创建 PR，并保留 worktree }
    - { id: keep, label: 保留分支, description: 不合并、不推送，稍后处理 }
    - { id: discard, label: 丢弃工作, description: 进入二次破坏性确认，不立即删除 }
  recommended: <existing option id>
  free_form: true
```

Detached HEAD removes `local-merge`; `recommended` must be `push-pr` when a PR workflow exists, otherwise `keep`. For named branches, prefer `push-pr` when the repository uses PRs, `local-merge` when it demonstrably does not, otherwise reversible `keep`. A recommendation never executes automatically.

Normalize clear free-form input to one existing id. Ambiguous input remains the same `finishing-choice` and is clarified without creating a fifth id. `discard` always proceeds to a separate literal confirmation.

## Step 4: Execute the Choice

### `local-merge`

From the common repository root: checkout base, `git pull --ff-only`, merge the feature branch, and rerun the verified checks on the merge result. Clean an owned worktree and delete the feature branch only after the merged checks pass.

### `push-pr`

Push with upstream, then actually create the PR using the repository-native integration or `gh pr create`. If no PR creation capability exists, report `blocked` with the pushed branch state; do not claim a PR exists. Keep the worktree for review feedback.

### `keep`

Report the branch and worktree path. Do not merge, push, or clean anything.

### `discard`

List the exact branch, commits, and worktree path that will be deleted. Require the user to type `discard` exactly. After confirmation, move to the common root, remove only a workflow-owned worktree, then delete the feature branch with `git branch -D`.

## Worktree Cleanup Ownership

- Paths under repository `.worktrees/` or `worktrees/` are workflow-owned and may be removed for successful `local-merge` or confirmed `discard`.
- Other worktree paths are host-owned. Use a native exit capability when available; otherwise preserve them.
- `push-pr` and `keep` never clean a worktree.

## Completion Contracts

### Direct

```text
Choice: local-merge | push-pr | keep | discard
Actions: 实际执行的命令与结果
Cleanup: worktree/branch 清理状态
Outcome: finished | kept | blocked
```

Report actual side effects and stop. Do not claim merge, PR, or cleanup that did not occur.

### Zhanggui Embedded

```text
SkillResult:
  request_id: <supplied SkillRequest.request_id>
  name: zhanggui-finishing-a-development-branch
  mode: zhanggui-embedded
  status: completed | blocked | awaiting-user | skill-required
  evidence: <Choice/Actions/Cleanup 实际证据-or-null>
  delta:
    Choice: local-merge | push-pr | keep | discard
    Actions: 实际执行的命令与结果
    Cleanup: worktree/branch 清理状态
    StageStatus: finished | kept | blocked
  question_request: <QuestionRequest-or-null；finishing-choice 等根投递问题>
  next_skill_request: <SkillRequest-or-null；证据缺失/过期时用 zhanggui-verification-before-completion>
```

`/zhanggui` ends the effort or continues after merging this delta. `skill-required` is handled by the root through `next_skill_request`, then this procedure resumes.
