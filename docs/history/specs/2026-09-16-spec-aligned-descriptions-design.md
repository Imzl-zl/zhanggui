# description 对齐 Agent Skills 规范设计

**状态：** 已实施（目录待重测）
**日期：** 2026-09-16
**目标版本：** v0.9.0（集合构成不变，只改 description）
**适用范围：** `skills/*/SKILL.md`、`tests/`、`evals/catalog-current.json`、`AGENTS.md`

## 1. 背景与证据

仓库纪律原先写的是「description 只写触发条件，以 `Use when` 开头」。核对一手资料后确认这条**不是社区规范，而且与规范要求相反**：

- 开放规范（`agentskills.io/specification`）：`description` 强制项只有非空与 ≤1024 字符；条目描述写的是 "Should describe both **what the skill does** and **when to use it**"，并给出 "Should include specific keywords"。
- 官方 `skills-ref` validator（`skills_ref/validator.py`）：`_validate_description` 只检查非空与长度，**完全不检查** `Use when`、人称、否定子句。强制层是 frontmatter 字段白名单 + `name` 格式（≤64、小写、不能首尾或连续连字符、必须等于父目录名）+ `compatibility` ≤500。
- Anthropic 作者指南：**"Always write in third person"**（POV 不一致会导致发现失败）；验收清单项 "Description includes both what the Skill does and when to use it"；判官要在 "potentially 100+ available Skills" 里选一个。
- 规范与官方**所有**示例一律是「能力在前、`Use when` 在后」，例如 `Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files...`。

实测本仓库：11 条 description **全部**以 `Use when` 开头，长度 164–418 字符（占 1024 上限的 16%–41%），**没有任何一条说明技能做什么**。判官只读 `name` + `description`，等于一半的发现信号被主动丢弃。

同时确认一个更基本的事实：**规范里没有「路由技能」这个概念**。启动时所有技能的 `name` + `description` 同时注入系统提示词，每个技能独立被发现、在同一个池子里竞争；想让某个技能调度其他技能，只能靠它自己的 description 去赢，没有额外机制。

## 2. 已确认决策

1. **description 改为能力在前**：一句第三人称的能力陈述 + 原有 `Use when` 触发子句。
2. **逐字保留全部既有触发关键词与前置条件**，包括 v0.9 针对三个确定性误路由加进去的 `the failing test or regression test must be written first, before any implementation code exists`、`has already passed verification`、`subagent capacity is available` 与 `non-overlapping files`。本批只做加法。
3. **自定上限 500 → 600 字符**：能力子句加进来后 500 会开始挤掉触发关键词；规范上限 1024 不变。600 是上下文预算纪律，属于本仓库自定，不与规范混淆。
4. **机械门改为正向结构检查**（`assertDiscoveryDescription`）：能力子句 ≥30 字符、必须带 `Use when` 子句且有实际触发内容、≤600 字符、不得以 `Use when` 开头、不得含步骤标记、不得含否定选择子句或行为指令。
5. **仓库规则文档分层**：`AGENTS.md` 新增「哪些是规范，哪些是本仓库自定」对照表，避免下一次再拿仓库习惯去覆盖规范。
6. **digest 门按既有纪律处理**：九个被钉住的 description 全部变化，`evals/catalog-current.json` 的 `status` 置为 `pending-reevaluation`，`supersedes` 改指 v0.9，`source_head` 置 `null` 直到重测发布 summary。
7. **description 必须是合法 YAML 普通标量**：首版能力子句里有 6 处 `": "`，官方 validator 直接报 `mapping values are not allowed here`。这暴露一个真实缺口：仓库的朴素 frontmatter 解析器读得下去，**只有官方 validator 报**，因此 `node --test` 当时全绿而 `npm run check` 报错。修完冒号后，把这条检查前移进 `assertDiscoveryDescription`。

## 3. 被放弃的方案

1. **只补能力子句，其他措辞一律不动。**
   - 最强的理由：改动最小、可归因，评测里只有一维变量变化。
   - 为何被否：基本采纳，但不完全 —— `init-project` 与 `zhanggui` 的触发子句本身很长，加上能力子句会顶到 500 上限，所以顺带把上限提到 600，而不是去删触发关键词。除上限外确实全程只做加法。
2. **保持 `Use when` 开头，把能力塞进触发子句后半。**
   - 最强的理由：机械门不用改，零测试改动；且已有实测命中率不为此买单。
   - 为何被否：规范与官方示例都把能力放在最前，判官读完第一段就形成能力印象；塞在长条件句后半等于继续丢信号。而且这些条件句本来就长，再追加会超出任何合理上限。
3. **把 500 上限一次放宽到规范的 1024。**
   - 最强的理由：一次到位，不再为字符数做取舍。
   - 为何被否：所有技能的元数据在启动时都进系统提示词，无上限会鼓励把 description 写成段落。600 足以容纳能力子句与触发子句，仍保留预算约束。
4. **只改两条 standalone 技能，先不碰被钉住的九条。**
   - 最强的理由：零成本 —— `init-project` 与 `decision-notes` 不在 `evaluatedSkills` 内，digest 门不会移动，不需要重测。
   - 为何被否：被钉住的九条才是真正在 100+ 技能池子里竞争的入口，只改不参与评测的两条等于回避问题。代价（目录进入待重测）已显式登记在 `catalog-current.json`。
5. **顺手把「不概述工作流」也做成机械门。**
   - 最强的理由：能变成检查项的规则才会被遵守。
   - 为何被否：无法在不制造误报的前提下判定「步骤概述」。只落了一条窄代理（拒绝 `Step N` 与编号列表标记），其余仍属评审级判断。

## 4. 已知代价

- 九个被评测的 description 变化，`evals/catalog-current.json` 进入 `pending-reevaluation`；重测之前**不得引用任何一版历史命中率描述当前目录**。v0.7 / v0.8 / v0.9 summary 作为只读历史记录保持不变。
- 重测成本：按 `required_before_claiming_rates`，需 122 cases × 3 runs × 双 arm，放入与 v0.8 相同的无关第三方干扰项，并保持判官提示词身份一致。
- 本批没有对应的失败用例，因此重测结果若变差，无法归因到某个具体 case；`changes_since_supersede` 已按此写成 `target_case: null`。
- `source_head` 置为 `null`：快照取自工作树，要到重测发布 summary 时才绑定 commit。
- 「以 `Use when` 开头」这个仓库自定习惯被推翻，是显式的行为变更，已登记在 `docs/history/README.md` 的差异表。
- description 变长会轻微增加启动时的元数据上下文（每条 +89~155 字符）。
- 能力子句不能直接使用冒号（`": "` 是 YAML 映射指示符），只能用破折号或改写句式；这是编写时的硬约束，已由机械门拦下。

## 5. 本批未引入

- 未重测（判官调用需另行授权与成本）。
- 未改动任何 `SKILL.md` 正文：路由谓词、契约、`STAGE.md`、Completion Contract 一律未动。
- 未新增关键词覆盖度指标；现有评测只测选中率，不测能力子句是否被正确理解。
- 未回填 v0.7 / v0.8 / v0.9 的历史 summary（它们是只读记录）。
