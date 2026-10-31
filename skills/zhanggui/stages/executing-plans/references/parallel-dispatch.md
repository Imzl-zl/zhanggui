# Parallel Dispatch - 执行阶段内联的并行派发纪律

执行阶段的同步子步骤，不占 `return_point` 单槽。规则原文只在这里维护。

原 `zhanggui-dispatching-parallel-agents` leaf 已退役：质量族实测 delta 为负（with 0.625 / without 0.750），且它在 discovery 上持续抢走本该归根的多模块统筹请求。纪律并入本文件后不再作为可发现技能存在。

## 何时并行

满足以下条件才并行：

- 多个失败的疑似根因不同，且可各自独立理解。
- Epic 子任务依赖已满足，写范围互不重叠。
- 每个域都能在没有其他域中间状态的情况下验证。

不并行：失败可能同源、需要全局状态、文件或资源重叠、顺序敏感。独立性不确定时先调查，不要猜。

## 派发

1. 按“独立坏掉的东西或独立交付物”分区。
2. 每个 agent 拿到自包含任务：确切范围、完整错误/测试/上下文证据、约束与非目标、期望输出与验证责任。
3. 所有独立 agent 在**一条消息**里派发；一次只派一个就是串行。
4. 写范围可能相邻时，先隔离写者：返回 `StageStatus: skill-required` 与 `SkillRequest(name=zhanggui-using-git-worktrees, mode=zhanggui-embedded)`；隔离能力不可用时退回不重叠范围或串行，并说明原因。

示例：坏的是“修所有测试”；好的是“调查 `agent-tool-abort.test.ts` 里这三个失败，不要加超时、不要改生产代码，返回一个已证实的根因”。

## 收集与整合

对每个结果：

1. 读报告，理解声称的改动。
2. 查看真实 diff 或输出；agent 自称成功不算证据。
3. 合并前检测同位置冲突与语义冲突。
4. 先跑各域聚焦验证，再跑集成后的完整套件或冒烟场景。
5. 高风险域按 [code-review.md](code-review.md) 内联审查；不适用时记录跳过理由。

任何域没有拿到自己的 diff 或结果，都不得报告为完成；被要求把并行工作当作已完成时，指出哪些域证据缺失。

## 输出

```text
DispatchPlan: 域划分与每个 agent 的 scope
AgentResults: 每个 agent 的摘要 + 实际 diff/结果核实
Conflicts: 冲突及处理
Validation: 各域和集成后的新鲜结果
DispatchStatus: integrated | conflicts-found | blocked | serial-fallback
```

`DispatchStatus` 只描述本次派发，不改变全局 phase、return point 或 readiness；`/zhanggui` 在核实后才更新 tracker 与父状态。
