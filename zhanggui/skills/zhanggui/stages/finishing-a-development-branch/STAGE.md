# Finishing a Development Branch — 分支收尾

这是 `/zhanggui` 的 supporting stage，不是独立 skill。verification 已 `verified` 且工作发生在独立分支/worktree 上，或用户要求收尾时读取。收尾方式是用户决定：本 stage 呈现结构化选项并执行选择，符合"未被要求不自行 commit/push/PR"的全局规则。

## 输入

```text
Verified: verification stage 的新鲜结论（必须为 verified）
Branch / Workspace: 当前分支与工作区状态
```

verification 不是 `verified` 时返回 `StageStatus: blocked`，先回验证/修复，不带着失败的检查进入收尾。

## Step 1: 检测环境

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

| 状态 | 菜单 | 清理 |
|------|------|------|
| `GIT_DIR == GIT_COMMON`（普通仓库） | 标准 4 选项 | 无 worktree 需要清理 |
| `GIT_DIR != GIT_COMMON`，具名分支 | 标准 4 选项 | 按来源判定（Step 4） |
| `GIT_DIR != GIT_COMMON`，detached HEAD | 精简 3 选项（无本地合并） | 不清理（外部管理） |

## Step 2: 确定 base 分支

```bash
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

不确定时构造 base 分支二选一 `QuestionRequest`，在更新等待状态后按入口“原生提问分发契约”发出，不直接输出文字问句。

## Step 3: 构造并分发 QuestionRequest

用户已经明确指定收尾方式时不重复询问，直接进入 Step 4。否则按当前 workspace 构造以下数据；这是分发契约，不是供模型照抄的文字菜单。

普通仓库与具名分支 worktree：

```yaml
QuestionRequest:
  id: finishing-choice
  question: 实现已验证，接下来如何处理？
  context: 当前分支 <feature>，目标分支 <base-branch>
  options:
    - { id: local-merge, label: 本地合并, description: 合并回 <base-branch> 并在合并结果上重跑验证 }
    - { id: push-pr, label: Push 并创建 PR, description: 推送 <feature> 并保留 worktree 供后续迭代 }
    - { id: keep, label: 保留分支, description: 不合并、不推送，稍后自行处理 }
    - { id: discard, label: 丢弃工作, description: 进入二次破坏性确认，不会立即删除 }
  recommended: <按下方规则选择的 option-id>
  free_form: true
```

Detached HEAD 删除 `local-merge`，把 `push-pr` 文案改为“Push 为新分支并创建 PR”。其 `recommended` 独立计算：已有 PR 流程时推荐 `push-pr`，否则推荐可逆且不产生远端副作用的 `keep`；不得引用已从 `options` 删除的 id。

普通仓库与具名分支的 `recommended` 根据用户既有意图和仓库协作方式得出：已有 PR 流程时推荐 `push-pr`；无 PR 流程时推荐 `local-merge`；证据不足时推荐可逆且无远端/合并副作用的 `keep`。推荐不代表自动执行。

更新等待状态后，按入口“原生提问分发契约”发出 `QuestionRequest`。原生工具可用时必须调用；只有能力缺失或 schema 无法忠实表达时才显式文字降级。

自由输入先作为同一个 `finishing-choice` 的反馈，不直接写入 `Choice`：语义明确等价于现有选项时规范化为对应稳定 id；否则复述理解、保留原反馈并按入口收敛循环更新选项说明/推荐后再次分发。收敛前不执行收尾动作，不创建第五个临时 id；`discard` 无论如何表达都必须继续通过下方原文二次确认。

## Step 4: 执行选择

**`local-merge`**：先 `cd` 到主仓库根，`git checkout <base>` → `git pull` → `git merge <feature>` → 在合并结果上重跑测试确认；确认成功后才清理 worktree、`git branch -d <feature>`。

**`push-pr`**：`git push -u origin <feature>`。**不清理 worktree**——用户需要它迭代 PR 反馈。

**`keep`**：报告“保留分支 <name>，worktree 在 <path>”。不清理。

**`discard`**：先确认——列出将永久删除的分支、提交和 worktree 路径，要求用户输入 `discard` 原文确认；确认后清理 worktree、`git branch -D <feature>`。

### Worktree 清理的来源判定（仅 `local-merge` 和 `discard`）

- 路径在 `.worktrees/` 或 `worktrees/` 下：本工作流创建的，负责清理——`cd` 到主仓库根后 `git worktree remove <path>` + `git worktree prune`。
- 其他路径：宿主环境所有，**不删**；有原生退出工具就用，没有就原地保留。

## 常见错误

| 错误 | 后果 → 纠正 |
|------|------|
| 未验证就给选项 | 合并坏代码 → 必须先有 verified 结论 |
| 开放式提问“接下来干嘛” | 含糊 → 构造固定 4/3 选项的 `QuestionRequest` 并按原生契约分发 |
| `push-pr` / `keep` 清理 worktree | 用户没法继续处理 → 只有 `local-merge` 和 `discard` 清理 |
| 先删分支再删 worktree | `branch -d` 失败 → 顺序：合并→删 worktree→删分支 |
| 在 worktree 内部执行删除 | 静默失败 → 先 `cd` 主仓库根 |
| 丢弃不要求确认 | 误删工作 → 必须输入 `discard` 原文 |

## 输出 delta

```text
Choice: local-merge | push-pr | keep | discard
Actions: 实际执行的命令与结果
Cleanup: worktree/branch 清理状态
StageStatus: finished | kept | blocked
```

本 stage 不设置全局 readiness；`finished`/`kept` 后由编排器结束 effort 或继续剩余工作。
