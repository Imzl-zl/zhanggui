---
name: zhanggui-using-git-worktrees
description: Use when starting isolated feature work, protecting a dirty checkout, separating parallel write scopes, or preparing to execute an implementation plan
---

# Using Git Worktrees

## Invocation Modes

### Direct

Use this mode when the skill is activated from the catalog or invoked explicitly. Derive the work goal from the request. Do not require or invent a Zhanggui task id, phase, return point, tracker, or readiness. Finish after reporting the workspace and baseline.

For manual creation, choose `BranchName` from an explicit user name first, then an unambiguous repository branch convention, otherwise `feature/<lowercase-hyphen-goal>`. State the chosen rule before creating anything.

### Zhanggui Embedded

Use this mode only when `/zhanggui` supplies the current task goal and isolation trigger. Use the task goal for naming, return the workspace/baseline delta to the same execute or parallel-dispatch frame, and never set global readiness or select the next task.

## Core Principle

Detect existing isolation first. Prefer host-native worktree tools. Use manual git worktrees only as a fallback. Never fight the host or nest isolation.

## Step 0: Detect Existing Isolation

```bash
git rev-parse --git-dir
git rev-parse --git-common-dir
git rev-parse --show-superproject-working-tree
git branch --show-current
```

- Different git/common dirs and no superproject path means this is already a linked worktree. Skip creation and continue with setup/baseline.
- A superproject path means submodule, not worktree; treat it as a normal checkout.
- In a normal checkout, honor an existing user worktree preference. Without one, ask once for consent. A refusal means work in place and continue with setup/baseline.

## Step 1: Create Isolation

### Native Host Tool First

Use `EnterWorktree`, `WorktreeCreate`, `/worktree`, or an equivalent exposed host capability when available. Native ownership controls placement and cleanup; do not also run `git worktree add`.

### Manual Git Fallback

Directory priority is explicit user preference, existing `.worktrees/`, existing `worktrees/`, then `.worktrees/`. Store the selected relative directory as `WORKTREE_DIR` and the full target as `WORKTREE_PATH="$WORKTREE_DIR/$BRANCH_NAME"`.

Before creating a project-local worktree, verify the selected directory is ignored. If it is not ignored, add that exact directory to `.gitignore` and commit the isolated setup change before continuing.

```bash
git check-ignore -q "$WORKTREE_DIR"
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"
cd "$WORKTREE_PATH"
```

The cwd handoff is a hard gate: run project setup, baseline, and every follow-on edit only from `WORKTREE_PATH`. If creation or switching cwd fails, report `blocked` and the exact partial state; never report `isolated` or silently edit the original checkout. Run manual creation from the common repository root. If sandbox permissions reject creation before any worktree exists, continue in place only when that preserves the user's requested isolation tradeoff; otherwise return blocked.

## Step 2: Project Setup

Detect the repository's existing setup path and run it: `package.json` uses its declared package manager, Cargo uses `cargo build`, Python follows the existing requirements/pyproject tool, and Go uses `go mod download`. Do not introduce a new package manager.

## Step 3: Verify Baseline

Run the project's actual test command before changing production files.

- Passing baseline: record command, counts, and zero failures.
- Failing baseline: report failures and ask whether to investigate or continue; do not silently proceed.
- No test command: record `Baseline: not available` with the repository evidence used to establish that fact. Never report it as passing.

## Red Flags

- Creating another worktree after existing isolation was detected.
- Running manual `git worktree add` when the host owns worktrees.
- Creating a project-local worktree before verifying ignore rules.
- Inventing a task or branch name with no stated rule.
- Skipping setup/baseline, or continuing past a failing baseline without a decision.

## Completion Contracts

### Direct

```text
Workspace: 路径与分支；原地工作时明确写 in-place
Baseline: 测试命令与结果，或 not available + evidence
Outcome: isolated | in-place | blocked
```

Report the workspace and stop. Do not claim that an unspecified task has started.

### Zhanggui Embedded

```text
Workspace: 路径与分支
Baseline: 测试命令与结果，或 not available + evidence
StageStatus: isolated | in-place | blocked
```

`/zhanggui` resumes the same frame after merging this delta. Cleanup rules remain in `../zhanggui/stages/finishing-a-development-branch/STAGE.md` until that procedure is loaded.
