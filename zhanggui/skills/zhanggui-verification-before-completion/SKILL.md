---
name: zhanggui-verification-before-completion
description: Use when an isolated claim of complete, fixed, passing, or ready needs fresh evidence before commit, push, PR, or task transition; defer to the zhanggui root for explicit or end-to-end workflow ownership
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

## 核心原则

**未经验证就声称完成是不诚实，不是效率。**

- 强制：**声称"完成/通过/修复"前必须运行验证命令并贴输出**
- 推荐：任何积极陈述前都先验证

## 验证流程

```
声称任何状态或满意前：

1. IDENTIFY：什么命令证明这个声称？
2. RUN：执行完整命令（fresh, complete）
3. READ：完整输出，检查 exit code，数失败
4. VERIFY：输出是否确认声称？
   - 否：陈述实际状态 + 证据
   - 是：陈述声称 + 证据
5. ONLY THEN：做声称

跳过任何步骤 = 没验证
```

## 常见失败

| 声称 | 需要 | 不够 |
|---|---|---|
| 测试通过 | 测试命令输出：0 失败 | 之前的运行、"应该过" |
| Linter 干净 | Linter 输出：0 错误 | 部分检查、推断 |
| 构建成功 | 构建命令：exit 0 | Linter 通过、日志看起来好 |
| Bug 修复 | 测试原症状：通过 | 改了代码、假设修了 |
| 回归测试有效 | Red-green 循环验证 | 测试通过一次 |
| Agent 完成 | VCS diff 显示改动 | Agent 报告"成功" |
| 需求满足 | 逐行 checklist | 测试通过 |

## 禁止措辞

声称完成前**绝不**用：

- "应该能过"
- "看起来对了"
- "我比较有信心"
- "理论上没问题"
- "应该是修复了"
- "应该工作"
- "Just this once"（仅此一次）


## Red Flags

**看到这些停下**：

- 用 "should" / "probably" / "seems to"
- 验证前表达满意（"Great!" / "Perfect!" / "Done!"）
- 未验证就 commit/push/PR
- 信任 agent 成功报告
- 依赖部分验证
- "仅此一次"
- 累了想结束工作
- **任何暗示成功但未运行验证的措辞**

## 关键模式

**测试**：
```
✅ [跑测试命令] [看到：34/34 pass] "所有测试通过"
❌ "应该现在过了" / "看起来对"
```

**回归测试（TDD Red-Green）**：
```
✅ 写 → 跑（通过）→ 回退修复 → 跑（必须 FAIL）→ 恢复 → 跑（通过）
❌ "我写了回归测试"（无 red-green 验证）
```

**构建**：
```
✅ [跑构建] [看到：exit 0] "构建通过"
❌ "Linter 通过"（linter 不检查编译）
```

**需求**：
```
✅ 重读 plan → 创建 checklist → 逐项验证 → 报告 gap 或完成
❌ "测试通过，phase 完成"
```

**Agent 委派**：
```
✅ Agent 报告成功 → 检查 VCS diff → 验证改动 → 报告实际状态
❌ 信任 agent 报告
```

## 何时应用

**ALWAYS before**：
- 任何成功/完成声称
- 任何满意表达
- 任何关于工作状态的积极陈述
- Committing、PR 创建、任务完成
- 进入下一任务
- 委派给 agent

**规则适用于**：
- 精确措辞
- 释义和同义词
- 成功的暗示
- **任何**暗示完成/正确的沟通

## 底线

**验证无捷径。**

跑命令。读输出。**然后**才声称结果。
