# 启动流、数据流与配置

## 启动入口

这个仓库没有传统应用意义上的单一 `main.ts`。它是 SDK，真实入口取决于宿主使用层级。

常见入口如下：

- `runDesktopDecision()`：只做决策，不执行 primitive。
- `runDesktopTask()`：先决策，再执行。
- `resumeDesktopTask()`：先恢复 checkpoint，再决策和执行。
- `DesktopHostClient.run()`：宿主侧常用执行入口。
- `DesktopHostClient.resume()`：宿主侧常用恢复入口。
- `createCodexDesktopLiveHostBundle()`：完整 Codex Desktop 宿主 bundle 入口。
- `createCodexDesktopLiveHostBundleFromHostObject()`：从宿主对象创建完整 bundle。

## 单次任务时序

一次 `hostClient.run(task)` 的主路径如下：

```text
宿主
  -> DesktopHostClient.run(task)
  -> runDesktopTask(...)
  -> runDesktopDecision(...)

runDesktopDecision(...)
  -> parseTaskEnvelope(task)
  -> classifyIntent(task)
  -> routeTask(task, intent, policy)
  -> createDesktopExecutionPlan(decision)
  -> loadMemoryOverview(...)
  -> runPreflight(...)
  -> evaluateApprovalRequirement(...)
  -> planAgentStrategy(...)
  -> buildCheckpoint(...)
  -> buildAuditEvents(...)
  -> buildObservabilityEvents(...)
  -> persistRunnerArtifacts(...)

得到 DesktopDecisionRunnerResult
  -> status = blocked_preflight | blocked_approval | ready
```

如果 `status !== ready`：

```text
executeDesktopPlan(...)
  -> 记录 runner_blocked audit event
  -> 返回 execution status = not_ready
```

如果 `status === ready`：

```text
executeDesktopTaskFromDecision(...)
  -> 检查 telemetry gate
  -> executeDesktopPlan(...)

executeDesktopPlan(...)
  -> 遍历 executionPlan.primitives
  -> 为每个 primitive 找 handler
  -> 调用宿主 bridge / binding / runtime
  -> 归一化输出 envelope
  -> 记录 primitive_executed 或 primitive_failed
  -> 按 checkpointFrequency 写 checkpoint
  -> 返回 completed 或 failed
```

## Resume 流程

`resume()` 不是简单从旧步骤继续执行。它更像“带记忆的重新决策”。

```text
DesktopHostClient.resume(task)
  -> resumeDesktopTask(...)
  -> resumeDesktopDecision(...)

resumeDesktopDecision(...)
  -> resolveResumeCheckpoint(...)
     -> 优先 memoryRecall
     -> 失败后 fallback 到 checkpointStore
  -> runDesktopDecision(...)
  -> 附加 resumedFrom / resumeSource
```

这意味着：

- 系统会先找历史 checkpoint。
- 然后仍然按当前 policy 重新跑决策。
- 结果中会说明恢复来源。

## 核心数据流

### 1. 任务输入流

```text
TaskEnvelopeInput
  -> parseTaskEnvelope()
  -> TaskEnvelope
```

`TaskEnvelope` 是后续所有模块共享的任务协议。

### 2. 决策流

```text
TaskEnvelope + PolicySnapshot
  -> IntentClassification
  -> RoutingDecision
```

`RoutingDecision` 包含：

- 任务类别。
- 风险等级。
- 模型选择。
- 工具权限。
- 执行 profile。
- 审批要求。
- 并行策略。

### 3. 执行计划流

```text
RoutingDecision
  -> DesktopExecutionPlan
  -> DesktopPrimitive[]
```

常见 primitive：

- `read_thread_terminal`
- `spawn_agent`
- `send_input`
- `wait_agent`
- `close_agent`
- `shell_command`
- `apply_patch`
- `automation_update`

### 4. 预检与审批流

```text
ExecutionPlan + PreflightContext
  -> PreflightResult

TaskEnvelope + RoutingDecision + PolicySnapshot
  -> ApprovalDecision
```

预检关注环境是否满足执行条件。审批关注是否触及保护分支、保护关键词、受保护工具权限或脏工作区。

### 5. 执行结果流

```text
Primitive handler output
  -> DesktopPrimitiveResultEnvelope
  -> DesktopLiveExecutionResult
```

执行结果会记录每一步 primitive 的状态、原因、输出和错误。

### 6. 治理附属流

```text
CheckpointRef
  -> checkpointStore
  -> memoryAdapter

AuditEvent
  -> auditStore

LogEvent
  -> telemetryStore
  -> alert / metrics / delivery window
```

## 配置文件

### package.json

`package.json` 表明这是一个 TypeScript ESM SDK 项目。

主要脚本：

- `npm run build`
- `npm run typecheck`
- `npm test`

主要依赖：

- `zod`：schema 校验。
- `yaml`：读取策略 YAML。
- `tsx`：运行 TypeScript 测试。
- `typescript`：类型检查和编译。

### tsconfig.json

使用：

- `target: ES2022`
- `module: NodeNext`
- `strict: true`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`

整体类型约束较严格。

### routing-policy.yaml

这是最重要的行为配置文件。

它定义：

- `policyVersion`：策略版本。
- `rolloutMode`：当前是 `desktop-first`。
- `models`：任务类别到模型的映射。
- `toolPolicies`：任务类别到工具权限的映射。
- `executionProfiles`：任务类别到执行 profile 的映射。
- `approvalRules`：保护分支、保护关键词、受保护工具权限。
- `escalationRules`：失败阈值、上下文压力阈值、高风险 sticky 行为。
- `memoryHealth`：不同工具权限下的 memory 健康策略包。
- `telemetryAlerts`：普通 telemetry 投递告警阈值。
- `telemetryAlertDeliveryAlerts`：告警投递本身的告警阈值。
- `telemetryAlertDeliveryWindow`：告警去重和 cooldown 窗口。

## 策略行为重点

默认映射大致如下：

```text
read_only
  -> gpt-5.4-mini
  -> read_only
  -> recon-only

small_edit
  -> gpt-5.3-codex-spark
  -> local_write
  -> engineering

engineering
  -> gpt-5.3-codex
  -> engineering_write
  -> engineering

high_risk
  -> gpt-5.1-codex-max
  -> engineering_write
  -> high-risk-change

release_external_action
  -> gpt-5.1-codex-max
  -> protected_remote
  -> release-governance
```

`release` 路径最严格：

- memory required。
- telemetry mandatory。
- checkpoint frequency dense。
- memory 问题通常 block。
- protected remote 工具权限触发 approval。
