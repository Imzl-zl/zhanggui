# Receiving Code Review Feedback — 临时内部阶段

这是 `/zhanggui` 处理外部审查反馈的 supporting stage，不是独立 skill。请求新的只读审查已由 `../../../zhanggui-requesting-code-review/SKILL.md` 负责；本文件只处理用户或审查者已经给出的反馈，下一步将独立迁移为 receiving leaf。

## 输入

```text
Feedback: 完整审查意见
Context: 当前代码、约束和已确认设计
ReturnPhase / ReturnNode: 从 execution 调用时提供
```

本 stage 是执行循环或意图路由的同步子步骤，不占 detour 单槽：不写 `WorkflowState.return_point`，`awaiting` 保持不变；Return fields 只原样回传。
## 接收外部审查反馈

```text
1. READ：完整读完再反应
2. UNDERSTAND：用自己的话复述需求（或提问）
3. VERIFY：对照代码库现实核实
4. EVALUATE：对本代码库是否技术正确
5. RESPOND：技术性回应或有据反驳
6. IMPLEMENT：一次一项，逐项测试
```

规则：

- 任何一项不清楚：**全部暂停**，先澄清。条目之间可能相关，部分理解 = 错误实现。
- 实施顺序：阻塞项（崩溃/安全）→ 简单修复 → 复杂修复；逐项验证，确认无回归。
- 反驳时机：建议破坏现有功能、审查者缺完整上下文、违反 YAGNI（grep 证明无调用方就提议删除而不是"实现完整"）、对本技术栈不正确、与既有 `owner:user` 决策冲突（冲突时先回 recap，不私改决策）。
- **禁止表演性同意**："You're absolutely right!"、"Great point!"、任何感谢套话。正确的反馈直接修，用代码说话："已修，改动在 X。"
- 反驳错了就事实性更正："核实过你是对的——X 确实如此，正在修。"不长篇道歉，不辩解。

## 输出 delta

```text
Clarifications: 仍需用户/审查者解释的条目
Accepted: 核实正确的反馈及理由
Rejected: 有证据反驳的反馈及理由
Changes: 已完成的逐项改动
Validation: 每项改动的新鲜验证
ReturnPhase / ReturnNode: 原样返回
StageStatus: feedback-resolved | changes-required | blocked
```

本 stage 不设置全局 readiness，也不私改 owner:user 决策。
