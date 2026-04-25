# 架构解读

## 总体定位

这个仓库是一个“桌面优先”的策略 SDK。它假设 Codex Desktop 或类似宿主已经提供真实执行能力，然后在宿主之上加一层治理：

- 任务分类。
- 模型路由。
- 工具权限控制。
- 审批 gate。
- 运行前 preflight。
- agent 并行策略。
- checkpoint / resume。
- audit / telemetry。
- memory 集成。

换句话说，它不是负责“怎么在系统里点按钮或改文件”的底层 runtime，而是负责“什么时候可以做、用什么权限做、做之前要检查什么、做完留下什么证据”。

## 架构分层

### 1. 协议与配置层

核心文件：

- `packages/contracts/src/index.ts`
- `packages/policy-config/src/index.ts`
- `routing-policy.yaml`

`contracts` 定义系统的共享语言，包括：

- `TaskEnvelope`
- `RoutingDecision`
- `DesktopExecutionPlan`
- `CheckpointRef`
- `DesktopPrimitive`
- `TaskClass`
- `ToolAccessLevel`

`policy-config` 负责把 `routing-policy.yaml` 解析成强类型 `PolicySnapshot`。

### 2. 决策层

核心文件：

- `packages/intent-gate/src/index.ts`
- `packages/routing-engine/src/index.ts`
- `packages/approval-gate/src/index.ts`
- `packages/preflight/src/index.ts`
- `packages/execution-profiles/src/index.ts`
- `packages/desktop-agent-strategy/src/index.ts`

这层决定任务能不能做、该怎么做。

`intent-gate` 做任务分类和歧义判断。  
`routing-engine` 根据策略选择模型、工具权限、执行 profile 和并行方式。  
`approval-gate` 判断是否需要审批。  
`preflight` 检查 auth、工具可用性、工作区状态和 memory 健康。  
`desktop-agent-strategy` 决定并行 agent 的角色、数量和 ownership。

### 3. 编排层

核心文件：

- `packages/desktop-decision-runner/src/index.ts`

这是当前最重要的中枢模块。它串起：

- `parseTaskEnvelope`
- `classifyIntent`
- `routeTask`
- `createDesktopExecutionPlan`
- `runPreflight`
- `evaluateApprovalRequirement`
- `planAgentStrategy`
- checkpoint 构建
- audit event 构建
- observability event 构建

最终返回 `DesktopDecisionRunnerResult`，状态只会是：

- `blocked_preflight`
- `blocked_approval`
- `ready`

### 4. 执行层

核心文件：

- `packages/desktop-bridge/src/index.ts`
- `packages/desktop-live-adapter/src/index.ts`

`desktop-bridge` 把 `RoutingDecision` 翻译成 `DesktopExecutionPlan`。  
`desktop-live-adapter` 接收 ready 的 runner result，然后逐步执行 primitive。

执行层本身不直接调用真实 Desktop API。它只调用宿主提供的 handler 或 bridge。

### 5. 宿主接入层

核心文件：

- `packages/desktop-host-client/src/index.ts`
- `packages/codex-desktop-bindings/src/index.ts`
- `packages/codex-desktop-live-host/src/index.ts`
- `packages/codex-cli-host/src/index.ts`

`desktop-host-client` 是宿主最常用入口，暴露 `run()` 和 `resume()`。  
`codex-desktop-bindings` 把 Codex Desktop runtime 方法映射成 SDK primitive binding。  
`codex-desktop-live-host` 把 runtime、memory、policy、preflight、host client 组装成完整 bundle。  
`codex-cli-host` 提供 Codex CLI 执行计划和 JSONL 输出解析能力。

### 6. 治理支撑层

核心文件：

- `packages/audit-memory/src/index.ts`
- `packages/codex-memory-adapter/src/index.ts`
- `packages/codex-memory-host-client/src/index.ts`
- `packages/codex-memory-mcp-client/src/index.ts`
- `packages/observability/src/index.ts`
- `packages/runtime-control/src/index.ts`
- `packages/recon-policy/src/index.ts`

这些模块负责 checkpoint、memory recall、MCP memory client、遥测、告警、升级模型、侦察命令限制等能力。

## 模块依赖图

```text
routing-policy.yaml
  -> policy-config
  -> routing-engine
  -> preflight
  -> observability

TaskEnvelope
  -> contracts
  -> intent-gate
  -> routing-engine
  -> desktop-bridge

desktop-decision-runner
  -> intent-gate
  -> routing-engine
  -> desktop-bridge
  -> preflight
  -> approval-gate
  -> desktop-agent-strategy
  -> audit-memory
  -> observability

desktop-live-adapter
  -> desktop-decision-runner
  -> host bridge / primitive handlers
  -> audit-memory
  -> observability

desktop-host-client
  -> desktop-live-adapter
  -> bridge 或 bridgeBindings

codex-desktop-live-host
  -> codex-desktop-bindings
  -> desktop-host-client
  -> codex-memory-host-client
  -> codex-memory-adapter
```

## 三根主梁

如果只能先读三个文件，优先读：

- `packages/desktop-decision-runner/src/index.ts`：决策。
- `packages/desktop-live-adapter/src/index.ts`：执行。
- `packages/codex-desktop-live-host/src/index.ts`：宿主集成。

这三个文件分别代表这个仓库的主控、执行和接入。
