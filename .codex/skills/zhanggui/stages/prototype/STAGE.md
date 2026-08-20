# Prototype - 用可运行证据回答一个决策节点

这是 `/zhanggui` 的 supporting stage，不是独立 skill。prototype 是当前 decision node 的临时证据，不是生产实现，也不拥有全局路由。

## 输入契约

必须从编排器接收：

```text
WorkflowState: 完整外层状态或其 checkpoint 路径
ParentDecisionId: Dn
Question: 这个原型唯一要回答的问题
SuccessSignal: 看完后能够做出的决定
```

没有 parent id 或 success signal 不开始。进入前由编排器把 `prototype.parent_id/status` 写回 state；跨会话或用户暂停时同步同一个 `DESIGN.md`。

## 选择分支

- 状态、数据形状或业务逻辑是否合理 -> [LOGIC.md](LOGIC.md)
- 页面、布局或交互应该长什么样 -> [UI.md](UI.md)

问题仍不清楚时先返回 `StageStatus: blocked`，不要用一个原型同时回答多个问题。

## 何时不做

- `ui_mode: Text-Only`。
- 已有成熟设计稿、设计系统或明确验收标准，直接判断更便宜。
- 只是颜色、文案或局部间距微调。
- 原型不能关闭或重塑任何 decision node。

## 共用规则

1. 文件顶部写 ParentDecisionId、Question 和 SuccessSignal。
2. 命名包含 `prototype`，不得被误认为生产代码。
3. 沿用项目 runner；独立 HTML 可直接打开。
4. 默认内存状态、无真实写操作；真实数据只读，mutation 使用 stub/隔离环境。
5. 不建生产抽象，不扩 scope，只实现足以观察问题的行为。
6. 必须实际启动或打开并完成 smoke check；UI 检查全部变体、桌面/移动、控制台和重叠。
7. 输出证据 delta，绝不设置全局 `Readiness`。

## 宿主选择

1. 真实导航、权限、数据密度或响应式容器会改变判断 -> 项目原生框架下的 dev-only 原型。
2. 无合适宿主、greenfield 或用户要轻量查看 -> 独立单 HTML。

集成原型不能直接接生产写操作。

## 生命周期与合并

- 用户尚未选择 -> `PrototypeStatus: pending`、`StageStatus: awaiting-user`；parent node 保持 open。
- 用户选择/组合/否决后 -> `PrototypeStatus: answered`；把 Result/Rejected 合并到 parent node，再由其 owner 确认或关闭。
- 其他 decisions、owners、ui_mode、open_nodes 和 fog 始终由外层 WorkflowState 保留，prototype delta 不能覆盖它们。
- 视觉-only 是否结束由编排器在合并全局 state 后判断。
- 结论吸收后删除临时原型；需要保留研究证据时遵循项目现有原型目录/分支约定。

## 输出 delta

```text
ParentDecisionId: Dn
Question: 已回答的问题
Artifact: 文件路径或运行 URL/命令
PrototypeStatus: pending | answered
Result: 胜出方向及理由
Rejected: 被否决方向及原因
StageStatus: awaiting-user | node-resolved | blocked
```

本输出只能更新 `WorkflowState.prototype` 和 parent decision；不能丢弃或重建外层 state。
