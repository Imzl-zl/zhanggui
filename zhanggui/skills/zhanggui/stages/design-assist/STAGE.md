# Design Assist - 模型主导的单节点设计

这是 `/zhanggui` 的 supporting stage，不是独立 skill。它只处理编排器当前选中的 `owner: model` decision node，并把 delta 返回当前编排 frame。

## 输入

从 WorkflowState 读取：

- `goal`、`constraints`、已定 `decisions` 和 `assumptions`。
- 当前 node 的 `id`、`domain`、`question`、`depends_on`。
- 全局 `owners`、`ui_mode`、剩余 `open_nodes` 和 `fog`。
- 现有 `DESIGN.md` checkpoint（如有）。

不要重问或重做已定结论。当前 node 依赖未满足时返回 `StageStatus: blocked`，不靠假设越过依赖。

## 决策边界

### 模型可以解决

- 项目已有约定固定的技术栈、模式和设计系统。
- 能通过代码、配置、环境、文档、官方资料或同类实现确认的事实。
- 可逆、局部、低风险且存在明显优解的 model-owned 选择。

"明显优解"自检：能用一句话说出被放弃的替代方案及不选它的代价，且结论不依赖用户独有信息（预算、偏好、业务规则）——任一不成立就不是明显优解，按下节转为 user-owned node。

### 必须转成 user-owned node

- 多个合理方案存在不可消除的长期重大权衡。
- 影响存量数据、公开接口、兼容性或不可逆迁移。
- 涉及安全、合规、隐私、资金或数据完整性边界。
- 依赖预算、团队能力或期限等工具无法获知的资源约束。
- 用户明确保留所有权。

用户没有回答不等于同意推荐。遇到上述情况，返回 `OwnershipChanges` 或新的 `owner: user` node；本 stage 不直接向用户批量提问。

## 研究规则

1. 先读现有代码、配置、设计系统和项目文档。
2. 新产品、陌生领域或 UI 空间会明显受益时，检查 2-3 个代表性同类产品、官方指南或最佳实践。
3. 记录参考改变了哪个判断，不堆链接。
4. 有 design checkpoint 时，必要原始资料可放 `<task_root>/<task>/raw/`；不为了缓存单独创建 tracker。
5. 外部资料只能缩小方案，不能替用户决定业务规则。

## 单节点流程

1. 验证依赖和事实，确认当前问题仍成立。
2. 比较可行方案；对 model-owned 明显优解形成一个决定和理由。
3. 若存在不可消除的用户权衡，生成 user-owned node，并把已做研究按入口"提问格式"打包进该 node 的 question——同类参考背景、2-4 个选项及差异、明确推荐——交给编排器后续调度；grilling 接手时直接复用，不重做研究。
4. 记录由本答案剪枝、否决或新暴露的节点；所有新 node 必须有稳定 id 和 `depends_on`。
5. 检查该 node 是否需要可运行证据；需要时只返回 `PrototypeRequest`，不直接调用 prototype。
6. 返回 delta；不设置全局 `Readiness`。

## UI 规则

| UI mode | 当前 UI node 的行为 |
|---|---|
| `Prototype-Assisted` | 视觉证据能减少不确定性时返回 `PrototypeRequest` |
| `Design-Owner` | 不改变 owner；model-owned UI node 给出推荐设计，user-owned node 应由编排器交给 grilling |
| `Direct` | 按既有稿件/设计系统解决当前 node |
| `Text-Only` | 用文字、表格或线框解决，不请求 prototype |

UI mode 不改变非 UI node 的 owner。

### 默认 UI 设计标准（用户无明确要求时）

当解决 UI domain 的 model-owned node 且用户未提供品牌、设计系统或具体风格要求时，应用以下标准：

**视觉质量基准**：
- 对标 Awwwards、FWA、CSS Design Awards 顶级网站品质
- 追求先锋视觉风格、实验性排版、流畅物理动效、冲击力文字版式
- 统一使用 [Lucide Icons](https://lucide.dev/)，禁止表情符号

**创意手法**（适度应用）：
- 非对称布局、视差滚动、3D 变换、粒子效果
- 大胆字体层级对比、高对比度配色、戏剧性光影
- 弹簧缓动、惯性滚动等流畅物理动效

**覆盖条件**：
- 用户明确规范时完全遵循用户要求
- B2B 后台/工具类场景优先可用性，适度使用艺术手法
- 用户要求"简洁"/"极简"/"工具向"时回归保守规范

详细规范见 `stages/prototype/UI.md` 的"默认设计标准"节。

## Owner 切换

用户说“这部分我要自己定”时，只返回对应 node/domain 的 ownership change：

```text
OwnershipChanges: Dn model -> user
```

其他 model-owned node 保持原 owner。stage 不 handoff 给 grilling；编排器合并后从全局 frontier 重新选节点。

## 输出 delta

```text
Resolved: Dn -> 结论、owner=model、理由
Assumptions: 新增或撤销的可逆假设
NewNodes: id、domain、owner、question、depends_on
Pruned: 被答案取消的 node 及原因
OwnershipChanges: 显式 owner 变化
PrototypeRequest: none | ParentDecisionId + Question + SuccessSignal
StageStatus: node-resolved | needs-user | needs-prototype | blocked
Next: 对编排器的一个建议动作
```

`StageStatus` 是局部结果。只要全局还有 `open_nodes`、`fog` 或 pending consensus，编排器必须保持 `Readiness: continue-design`。
