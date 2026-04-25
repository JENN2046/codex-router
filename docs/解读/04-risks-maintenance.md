# 风险、技术债与维护注意点

## 主要风险

### 1. 任务分类偏启发式

`intent-gate` 主要依赖关键词和简单规则。优点是可控、可测试；缺点是对复杂自然语言、隐含意图、中英文混杂和上下文依赖任务不够稳。

典型风险：

- 高风险任务被误判成普通 engineering。
- release 类动作没有命中关键词。
- read-only 解释类任务被误判成 engineering。
- “继续”“修一下”这类上下文任务歧义不足。

### 2. 策略文件是行为单点

`routing-policy.yaml` 决定模型、权限、审批、memory、telemetry 和告警阈值。

风险是配置变化可能直接改变治理语义。例如：

- 降低工具权限约束。
- 取消 protected remote 的审批。
- 把 release memory block 改成 warn。
- 改 telemetry mandatory 行为。

这类变化不一定会破坏类型检查，但会改变系统安全边界。

### 3. `desktop-decision-runner` 职责偏重

这个模块当前负责：

- parse
- classify
- route
- execution plan
- memory overview
- preflight
- approval
- agent strategy
- checkpoint
- audit
- observability
- persistence
- resume annotation

它已经接近主干编排器的复杂度上限。后续需求继续堆进去，会提高回归风险。

### 4. 宿主语义无法只靠类型保证

`codex-desktop-bindings` 能把宿主 runtime 接成 SDK binding，但类型正确不代表语义正确。

典型风险：

- `spawn_agent` 返回值没有可识别 agent id。
- `wait_agent` 返回状态字段不符合预期。
- `shell_command` 输出结构不稳定。
- `apply_patch` 的 patch payload 与宿主实际要求不一致。
- session 中 active agents 没有正确写入或清理。

### 5. Memory 和 telemetry 已经是硬门控

在 engineering 和 release 路径中，memory / telemetry 不只是附加能力。

尤其 release 路径：

- memory overview 不可用会 block。
- codex MCP adapter 不可用会 block。
- rejected memory writes 会 block。
- recall 不可用会 block。
- telemetry sink 缺失会 block。

这对治理是好事，但会显著提高宿主接入复杂度。

### 6. Observability 模块较重

`observability` 同时包含：

- log event
- telemetry sink
- alert sink
- fanout
- timeout
- retry
- metrics collector
- threshold evaluation
- alert delivery window
- suppression persistence

功能完整，但复杂度集中。后续改动要特别小心主执行路径是否被非关键 telemetry 后端阻塞。

### 7. 文档面大，运行事实要回源码确认

`docs/` 和 `README.md` 覆盖很多场景，包括最终宿主、target embedding、MCP memory、release candidate 等。

维护时要区分：

- 当前源码已实现的行为。
- 文档中的操作建议。
- 历史阶段说明。
- 面向未来接入的 scaffold。

当文档和代码冲突时，应以当前源码和当前策略文件为准。

## 最容易被忽略的回归

这些回归可能不会表现为 TypeScript 编译错误：

```text
read_only 任务意外拿到 write 权限
engineering 任务缺 telemetry 却继续执行
release 任务没有被 approval gate 阻断
memory degraded 被错误当成 blocked
protected branch 只 warning 不 pending approval
spawn_agent 成功但 session 没记录 active agent
resume 找到 checkpoint 但没有写 task_resumed audit event
telemetry fanout 的非关键后端阻断主流程
```

维护时不要只问“代码能不能跑”，还要问“治理边界有没有变”。

## 设计优点

### 协议边界清楚

`contracts` 把输入输出、状态、权限、primitive 都收口了。治理型系统最怕到处传 loosely typed object，这个仓库在这点上做得比较克制。

### 策略与实现分离

`routing-policy.yaml` 承担了大量行为定义，使“改策略”和“改代码”能部分解耦。

### 决策和执行分离

`desktop-decision-runner` 决定是否可执行、如何执行。  
`desktop-live-adapter` 负责按 plan 调用宿主 primitive。

这条边界合理，也方便测试。

### 宿主适配层完整

`desktop-host-client`、`codex-desktop-bindings`、`codex-desktop-live-host` 说明项目目标不是 repo 内 demo，而是可嵌入真实宿主的 SDK。

### 治理考虑全面

仓库覆盖：

- 审批。
- protected branch。
- dirty workspace。
- memory health。
- telemetry mandatory。
- checkpoint。
- resume。
- audit。
- alert delivery。
- suppression window。

这让它更像生产治理组件，而不是一次性执行工具。

## 推荐维护策略

后续开发最好按三条线分离：

- 策略线：`contracts`、`policy-config`、`routing-engine`、`preflight`。
- 执行线：`desktop-bridge`、`desktop-live-adapter`、`desktop-agent-strategy`。
- 接入线：`desktop-host-client`、`codex-desktop-bindings`、`codex-desktop-live-host`、`codex-memory-*`。

避免把宿主特例、策略特例、遥测特例继续塞进 `desktop-decision-runner`。它已经是主干编排器，继续变重会明显提高维护成本。
