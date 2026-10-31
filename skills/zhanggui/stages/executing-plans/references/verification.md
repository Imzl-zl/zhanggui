# Verification - 声称前先拿新鲜证据

执行阶段的收尾纪律。规则原文只在这里维护；`zhanggui-verification-before-completion` 只保留调用契约并指向本文件。

**未经验证就声称完成是不诚实，不是效率。**

## 循环

```text
声称任何状态或表达满意前：
1. IDENTIFY：什么命令证明这个声称？
2. RUN：执行完整命令（fresh、complete，不复用上次结果）
3. READ：读完输出，检查 exit code，数失败
4. VERIFY：输出是否真的支持这个声称？
5. ONLY THEN：做声称
跳过任一步 = 没验证
```

## 输出形状

```text
Claim: 要声称的状态
Evidence: 实际运行的命令/场景、exit code 和关键结果
Coverage: 覆盖到的验收条件
Gaps: 未验证或失败项
Outcome: verified | not-verified
```

`not-verified` 报告实际状态与缺口后结束，不假装下一步会接手。

## 声称与所需证据

| 声称 | 需要 | 不够 |
|---|---|---|
| 测试通过 | 测试命令输出：0 失败 | 之前的运行、"应该过" |
| Linter 干净 | Linter 输出：0 错误 | 部分检查、推断 |
| 构建成功 | 构建命令 exit 0 | Linter 通过、日志看着好 |
| Bug 修复 | 复现原症状的测试通过 | 改了代码、假设修了 |
| 回归测试有效 | red-green：回退修复后必须 FAIL | 测试通过一次 |
| Agent 完成 | 自己查 diff 与验证 | agent 报告"成功" |
| 需求满足 | 逐条 checklist | 测试通过 |

## 禁止措辞与红旗

- "应该能过"、"看起来对了"、"理论上没问题"、"应该是修好了"、"Just this once"
- `should` / `probably` / `seems to`；验证前的 "Great!" / "Perfect!" / "Done!"
- 未验证就 commit / push / 开 PR；信任 agent 成功报告；依赖部分验证；累了想收工

## 何时必须应用

任何成功/完成声称、任何满意表达、commit/PR/任务完成前、进入下一任务前、委派给 agent 前后。规则覆盖精确措辞、同义改写和一切暗示完成的表达。

## 与其他纪律的关系

- 代码审查通过 **不等于** 完成验证。审查管"改动对不对"，验证管"声称成不成立"。
- 用户明确拒绝本步验证时，指出缺失的证据一次即停，不要越过用户的决定。
- 已进入收尾决策（合并/开 PR/保留分支）时，`zhanggui-finishing-a-development-branch` 拥有那一步的前置验证。

## 底线

跑命令。读输出。**然后**才声称结果。
