# Code Review - 独立审查一次改动

执行阶段的同步子步骤，不是 detour，不占 `return_point` 单槽。规则原文只在这里维护；`zhanggui-requesting-code-review` 只保留调用契约并指向本文件。

## 何时必须审

改动涉及安全、迁移、公开接口、存量数据、多文件、Epic 子任务边界、合并/交付，或用户明确要求审查时，**验证前必须审**。

单文件低风险改动、纯文档、一次性原型可以跳过，但必须由 `/zhanggui` 记录跳过理由。

## 流程

1. 解析确切的 git 范围或工作区 diff，并写明它。
2. 解析审查契约（SPEC / decisions / task goal+boundary）。Direct 模式没有契约时，把契约轴标为 unchecked，不要发明契约。
3. 有 subagent 能力时派一个独立审查者，用 [code-reviewer.md](code-reviewer.md)：
   - `DESCRIPTION` = 实现摘要；`PLAN_OR_REQUIREMENTS` = 真实契约或 `not provided - quality review only`；`BASE_SHA`/`HEAD_SHA` = 解析出的范围。
4. 没有 subagent 时自己读完整 diff，按同样两条轴审：
   - **Fidelity**：实现是否符合给定要求，偏差在哪里。
   - **Quality**：正确性、错误处理、边界、安全、真实行为测试、迁移、兼容性、生产就绪。
5. **全程只读**：不改工作区、索引、HEAD 或分支。
6. 每条发现先定性质再定级别：
   - **Architecture**：重复逻辑、第二真值源、缺失或多余的抽象、模块边界错误、会逼出大量后续改动的设计。级别至少 Important，**修法是重设计并路由回 design**，不是就地补丁。
   - **Detail**：局部 bug、边界、命名、错误处理、测试缺口。就地修，级别按实际影响。
   每条必须给 `file:line`、影响和具体修法。

## 级别语义

- **Critical**：bug、安全缺陷、数据丢失、行为损坏。
- **Important**：缺失行为、架构缺陷、错误处理不足、实质性测试缺口。
- **Minor**：风格、优化、文档打磨。
- **Plan defect**：明确指出，但**不在审查里重新设计**。
- **审查者说错了**：用代码、测试或构建证据反驳，不要表演式接受。

## 报告形状

```text
Scope: 实际审查范围
ContractCoverage: checked | unchecked
Strengths: 做得好的具体点
Findings: [{severity, file:line, what, why, fix}]
Assessment: ready | ready-with-minor-notes | fixes-required | blocked
```

审查通过 **不等于** 完成验证；新鲜验证仍然必须单独做。
