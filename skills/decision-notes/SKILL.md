---
name: decision-notes
license: MIT
description: Records the reasoning behind a choice — which alternatives were rejected, why, and what the choice cost — including for code that looks deliberately odd or a decision that must not be re-litigated. Use when a choice between alternatives, a non-trivial change, an upgrade, an incident fix, or an abandoned attempt needs its reasoning recorded, including when someone asks to write a decision note, when an option that was already rejected is proposed again, or when a superseded decision must be preserved instead of rewritten.
---

# Decision Notes - 决策笔记的落盘与生命周期

## 定位

`.agents/notes/` 记录代码装不下的「为什么」：当初为什么这么定、否定过哪些方案、为此付出了什么代价。

它和 `docs/` 是两件事：`docs/` 回答「现在怎么运转」，笔记回答「当初为什么这样」。两边都不许越界，否则各写一半、谁也找不到想要的。

本技能只管 `.agents/notes/` 这一个目录。项目里还没有这套骨架时先跑 `setup-collaboration-files`；只有确实要单独补笔记时才由本技能按下面 Step 1 最小创建。

## 读取顺序

1. 先读 `<repo_root>/.agents/notes/AGENTS.md`。它是**仓库不变量**的真值源：状态由目录决定、禁止总索引、`implemented/` 随代码更新、`archived/` 永久冻结。
2. 需要判定标准、四格写法、取代流程或验收清单时读 `references/notes-contract.md`。
3. 需要能直接照抄的骨架时读 `references/note-template.md`。

仓库文件与 `references/notes-contract.md` 冲突时**以仓库文件为准**，并在最终总结里点名冲突——不要静默择一。

## Workflow

### Step 1: 确认运行时契约

- `.agents/notes/AGENTS.md` 存在 → 按它执行，继续 Step 2。
- 整个 `.agents/notes/` 不存在 → 先提示"建议运行 `setup-collaboration-files` 归一协作文件体系"；用户要继续时，按 `references/notes-contract.md` 建最小骨架（`AGENTS.md` + `proposed/`、`implemented/`、`rejected/`、`archived/`），不要把 `setup-collaboration-files` 的其余产物一起造出来。

### Step 2: 判定是否真的需要留笔记

按 `references/notes-contract.md` 的**非平凡判定表**逐条对照：

- 命中任一项 → 必须留笔记，继续 Step 3。
- 纯机械改动（改样式、格式化、打标、不改行为的依赖补丁、常规 CRUD）→ 直接交代码，**不要造笔记**。
- 判不准 → 按"要留"处理；日后会被重访的决定也算非平凡。

没有判定表就没有触发条件，规则会退化成"以后补"，然后不补。

### Step 3: 定状态并起草四格

状态由目标目录决定，先想清楚这篇属于哪一类：

| 目录 | 含义 | 何时用 |
|---|---|---|
| `proposed/` | 待评审 | 动手前，方案还没定 |
| `implemented/` | 已落地 | 改动的代码与笔记同批落地 |
| `rejected/` | 已否决 | 方案被否，但要留否定理由 |
| `archived/` | 被取代 | 曾经生效，已被新决定取代 |

起草时遵守三条硬约束（写法细节见 `references/notes-contract.md`）：

- `Alternatives considered` 每条**先写它最强的理由**，再写为何被否。只写缺点的替代方案等于立稻草人，后来者没法判断前提是否变了。
- `Consequences` 必须同时有收益和代价。没有代价的决定，通常是没挑过的。
- `implemented/` 里只写已经发生的事，不写 `## Proposal` / 计划类标题。

### Step 4: 落盘

路径与文件名按 `references/note-template.md`：`<状态目录>/[分组/]YYYY-MM-DD-<kebab-slug>.md`。

严禁顺手创建一个总索引文件来"方便查找"——并行分支必然在那一个文件上冲突，状态由目录位置表达就够了。

### Step 5: 代码入口回指

在被这条决定约束的代码入口留**一行**注释指回本篇笔记：

```text
// Note: 为什么这里必须容忍空批次 —— 见 .agents/notes/implemented/process/2026-07-26-empty-batch-tolerance.md
```

没有回指，下一个会话只会先看到"这段代码写得别扭"，然后顺手重写掉。

### Step 6: 取代，而不是改写

架构升级或被后续决定取代时：

- 旧篇**结论不改**，加一行标注被哪一篇取代，并移入 `archived/`。已经发生的决定不能假装没发生过。
- 新篇引用旧篇，写清旧篇还管哪些历史场景、这次升级的全部代价。
- 迁移只走相邻边（V1→V2→V3），每代一个独立迁移包，不把兼容分支写进主路径。

### Step 7: 验收

输出结果前回读并逐条确认 `references/notes-contract.md` 的验收清单：四格齐全、Alternatives 每条的"最强理由 + 为何被否"都在、Status 与目录一致、没有 Proposal 类标题、有代码回指、旧篇未被改写、没有新增总索引文件。

## 与掌柜的配合

掌柜的设计阶段已经记录了每个决策节点和被剪掉的分支，那是 `Alternatives considered` 的现成初稿，直接搬过来，不要重新想一遍。落盘时机取在验证通过、准备收尾那一步：测试管这次有没有做对，笔记管下次别把旧账忘了，两者缺一个都不算完工。

## 边界

- 不写 `docs/` 的现状事实，也不写事故复盘（真实踩过的雷与线上事故进 `docs/postmortem/`）。
- 不复述 `setup-collaboration-files` 的协作文件规则，不去动 `tools.md` / `memory.md`。
- 不凭空发明仓库里不存在的格式；仓库契约优先，其次才是本技能的 `references/`。
