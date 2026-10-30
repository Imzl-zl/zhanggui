# Decision Notes — 骨架与示例

## 空骨架

```markdown
# Agent Note: <一句话标题，写结论不写主题>

Status: implemented

## Problem

<没写下什么，导致谁推断出了什么更严的假限制。写现象，不写背景故事。>

## Decision

<一句话裁定。>

准入门槛（可机械判定）：

1. <门槛一：判定标准 + 通过的样子 / 不通过的样子>
2. <门槛二>

## Alternatives considered

1. <被放弃的方案名>
   - 最强的理由：<它真正强在哪>
   - 为何被否：<真实原因，不是"不够优雅">
2. <被放弃的方案名>
   - 最强的理由：<……>
   - 为何被否：<……>

## Consequences

- 收益：<换来了什么，是否真的删掉了旧负担>
- 代价：<付出了什么，供应链/依赖/维护面是否变大>
```

## 落盘路径

```text
.agents/notes/proposed/2026-07-26-empty-batch-tolerance.md
.agents/notes/implemented/2026-07-26-empty-batch-tolerance.md
.agents/notes/implemented/process/2026-07-26-empty-batch-tolerance.md
.agents/notes/rejected/2026-07-20-merge-into-index.md
.agents/notes/archived/2026-06-28-weekly-digest.md
```

日期取决定作出或落地的日期，标题用 kebab-slug。`Status` 与目录必须一致。

## 已落地示例（示意，非任何真实仓库的记录）

```markdown
# Agent Note: 优先引持续维护的依赖，而不是手写实现

Status: implemented

## Problem

仓库里外部依赖清单一直很短，agent 据此推断出一条"不要加依赖"的隐性规则，
于是手写了解析器、重试循环和协议分帧器。这些手写轮子的边界情况，全靠自己写单测兜。

## Decision

引入外部依赖是正当的简化，不是政策特例。用维护良好的包替换手写实现，与任何其他
简化走同一套证据标准。

准入门槛：

1. 净删除：引包必须能真删掉自己手写的实现、测试和文档。只是套一层 wrapper 不算。
2. 健康度：持续维护、被广泛使用。不拿别人弃坑的代码换自己的代码。
3. 契合度：库的接口能直接覆盖业务语义，仍需手工补齐的残留逻辑越少越好。
4. 不重开已定案：已定的基石架构不因这条政策重新讨论。

## Alternatives considered

1. 维持隐性的"不加新依赖"文化
   - 最强的理由：零风险，依赖清单继续短，评审不需要额外判断。
   - 为何被否：它从来不是一条有记录的决定。手写代码重复实现了生态已修的边界情况，
     还按文件抬高了覆盖率负担。
2. 搞一份获批包白名单
   - 最强的理由：看起来可控，边界清晰。
   - 为何被否：白名单本身也要养；按 PR 设门槛就够，多一层清单只多一处腐化点。
3. 每个新依赖都 vendor 进源码
   - 最强的理由：能打补丁、能锁死上游，不怕上游乱改。
   - 为何被否：把本要卸下的维护负担又背了回来，正好和"净删除"相反。

## Consequences

- 收益："用包 Y 换掉手写 X" 算正规简化，简化机会的识别有了明文依据。
- 代价：依赖清单会变长，供应链接触面变大。
```

## 反例（校验会拦住的写法）

```markdown
## Proposal

我们计划引入缓存层……            # implemented/ 里禁止计划类标题

## Alternatives considered

1. 自己写一套
   - 缺点：容易出 bug        # 只写缺点，没写它最强的理由

## Consequences

- 收益：性能更好              # 只有收益，没有代价
```
