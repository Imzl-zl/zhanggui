# Receiving Feedback - 逐条核实外部审查意见

执行阶段的同步子步骤。处理**已经存在**的反馈；产出新审查属于 [code-review.md](code-review.md)。规则原文只在这里维护；`zhanggui-receiving-code-review` 已退役，此处是唯一维护处。

## 循环

```text
1. READ：先读完所有意见再反应
2. UNDERSTAND：复述要求，或提出精确问题
3. VERIFY：拿建议去对仓库现状核实
4. EVALUATE：判断它在这个项目、这个技术栈里是否真的成立
5. RESPOND：技术上确认，或用证据反驳
6. IMPLEMENT：一次处理一条已接受的，并逐项验证
```

## 规则

- 任一条不清楚就**暂停全部实现**先澄清。相关联的条目让"部分理解"不可靠。
- 已接受的按顺序做：崩溃/安全类 → 简单修 → 复杂修。每条都要验证并检查回归。
- 该反驳就反驳：建议破坏了正常行为、缺少必要上下文、违反 YAGNI、不适合本技术栈、或与已记录的 `owner:user` 决定冲突。
- 反驳必须落在代码、引用、测试或构建证据上。
- **不要表演式同意**：不写赞许、感谢、"你说得完全对"。正确的反馈用一句技术陈述加已验证的改动来确认。
- 自己的反驳被证明是错的：直接纠正事实，不要长篇道歉或辩解。

## 输出形状

```text
Clarifications: 仍需解释的条目
Accepted: 核实正确的反馈及理由
Rejected: 有证据反驳的反馈及理由
Changes: 已完成的逐项改动
Validation: 每项改动的新鲜验证
Outcome: feedback-resolved | blocked
```

反馈与某个 `owner:user` 决定冲突时，把冲突作为 `blocked` 返回；recap 与设计改动由 `/zhanggui` 拥有。
