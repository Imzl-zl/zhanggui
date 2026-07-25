# Dispatching Parallel Agents — 并行派发

这是 `/zhanggui` 的 supporting stage，不是独立 skill。多个互不相关的问题域可以并行处理时读取：Epic 中写范围不冲突的子任务、多个独立失败的并行调查、同质批量行的受控并行。宿主没有 subagent 能力时本 stage 不适用，退化为串行执行。

**核心原则：一个独立问题域派一个 agent；精确构造它需要的上下文，绝不继承会话历史。**

## 何时用 / 何时不用

用：

- 3+ 个测试文件因不同根因失败，各自可独立理解。
- Epic 子任务依赖已满足、写范围互不冲突。
- 每个问题不需要其他问题的上下文。

不用：

- 失败相关（修一个可能连带修好其他）——先一起调查。
- 需要看全系统状态才能理解。
- agents 会互相干扰（同文件、同资源）。判断相关性拿不准时先派一个探查，不要赌。

## 派发模式

1. **划定独立域**：按"坏的是什么"分组，确认修 A 不影响 B。
2. **构造聚焦任务**，每个 agent 拿到：
   - 明确 scope（一个文件/子系统/CSV 行的 goal+boundary）；
   - 完整自足的上下文（错误原文、测试名、约束——不是"修一下竞态"）;
   - 明确约束（"不改生产代码"/"只动 boundary 内"）；
   - 明确输出（"返回根因与改动摘要"）。
3. **同一条消息里发出全部派发** = 并行；一条一个 = 串行。
4. 写范围可能相邻时，给每个 agent 配独立 worktree（见 `../using-git-worktrees/STAGE.md`）。

Prompt 反面示例：

- ❌ "把测试都修了"（太宽，agent 迷路）→ ✅ "修 agent-tool-abort.test.ts 的 3 个失败（原文如下）"。
- ❌ 不给约束（agent 顺手重构一切）→ ✅ "不要只加超时，找真实原因；不改生产代码"。

## 回收与集成 — 不信任报告

agents 返回后：

1. 读每份摘要，理解改了什么。
2. **看 VCS diff 验证真实改动**——agent 说"成功"不是证据。
3. 检查冲突：是否改了同一处代码。
4. 跑完整测试套件确认所有修复共存。
5. 与 CSV 真值的关系：**agent 不拥有 WorkflowState 或 tracker**；每行状态由主编排在 diff+validation 核实后更新，父子状态按 child 真值重算。

## 每任务审查（可选加强）

高风险子任务完成后，在标记 DONE 前按 `../../../zhanggui-requesting-code-review/SKILL.md` 的 `Zhanggui Embedded` 模式做任务级审查（忠实轴对照该行 goal+boundary），Critical/Important 修完再继续。避免问题在后续任务上层层复利。

## 输出 delta

```text
DispatchPlan: 域划分与每个 agent 的 scope
AgentResults: 每个 agent 的摘要 + diff 核实结论
Conflicts: 冲突及处理
Validation: 集成后的完整套件结果
StageStatus: integrated | conflicts-found | blocked
```

本 stage 不设置全局 readiness；集成结果并回执行循环，完成声称仍走 verification。
