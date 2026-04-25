# 二次开发与 Code Review 清单

## 二次开发扩展点

### 新增任务分类规则

优先修改：

- `packages/intent-gate/src/index.ts`
- `tests/intent-gate.test.ts`

适合增加：

- 关键词。
- 歧义原因。
- 分类优先级。
- taskClass hint 行为。

注意不要让 release / high-risk 类任务被更低优先级规则覆盖。

### 新增策略字段

优先修改：

- `packages/policy-config/src/index.ts`
- `routing-policy.yaml`

如果新字段影响执行，还要继续传入：

- `routing-engine`
- `preflight`
- `desktop-decision-runner`
- `observability`

策略字段必须有 schema 校验和测试覆盖。

### 新增模型或工具权限

优先修改：

- `packages/contracts/src/index.ts`
- `routing-policy.yaml`
- `packages/routing-engine/src/index.ts`
- 相关测试

这是高影响改动，因为模型 ID、工具权限和审批规则都依赖枚举。

### 新增宿主 primitive

需要从协议一路补到执行层：

- `contracts` 的 `DesktopPrimitiveSchema`
- `desktop-bridge`
- `desktop-live-adapter`
- `codex-desktop-bindings`
- result envelope
- tests

这是跨模块改动，风险较高。必须覆盖 missing handler、成功、失败和 telemetry / audit 行为。

### 新增真实宿主接入

优先扩展：

- `codex-desktop-live-host`
- `codex-desktop-bindings`
- 新的 host binding 模块

避免把宿主细节塞进 `desktop-decision-runner`。runner 应该保持宿主无关。

### 新增 memory 后端

优先实现：

- `CodexMemoryClient`
- 或 `MemoryAdapter`

然后通过 `desktop-host-client` 的 persistence 接入。

### 新增 telemetry 后端

实现：

- `TelemetrySink`
- 或 `TelemetryAlertSink`

然后通过 `observability` 的 fanout 接入。

## Code Review 重点

### contracts

检查：

- 是否破坏协议兼容性。
- 枚举新增是否全链路同步。
- schema 默认值是否改变行为。
- optional 字段是否影响 `exactOptionalPropertyTypes` 下的类型语义。

### routing-policy.yaml

检查：

- 是否和 `PolicySnapshotSchema` 对齐。
- 是否无意扩大工具权限。
- 是否降低 release / protected remote 的审批要求。
- memory / telemetry policy pack 是否仍符合风险等级。

### routing-engine

检查：

- 高风险任务是否仍保持高风险路径。
- protected branch / protected keyword 是否会进入 approval reasons。
- parallelism mode 是否和工具权限匹配。
- ambiguity 是否会正确切到 `clarify-then-plan`。

### preflight

检查：

- 本该 block 的条件是否被改成 warning。
- read-only 与 write 路径对 dirty workspace / protected branch 的差异是否正确。
- memory overview unavailable 的 severity 是否按 policy pack 生效。
- release pack 是否仍严格。

### approval-gate

检查：

- protected branch 是否追加 approval reason。
- dirty workspace 是否进入 pending approval。
- dedupe 是否保留。

### desktop-decision-runner

检查：

- 是否先决策、预检、审批，再进入执行。
- checkpoint stage 是否准确。
- audit events 是否覆盖 blocked 和 ready 路径。
- observability events 是否包含 preflight 和 memory preflight。
- persistence 失败是否按预期冒泡。
- resume 结果是否包含 `resumedFrom` 和 `resumeSource`。

### desktop-live-adapter

检查：

- `not_ready` 是否不执行 primitive。
- missing handler 是否 fail-fast。
- handler 抛错是否转成 failure envelope。
- `stopOnFailure` 行为是否正确。
- telemetry mandatory 缺 sink 是否阻止执行。
- checkpoint frequency 是否按 policy guidance 生效。

### codex-desktop-bindings

检查：

- `spawn_agent` 是否能拿到 agent id。
- session 是否正确记录 active agents。
- `send_input` 无 agent 时 noop / fail 行为是否符合配置。
- `wait_agent` 和 `close_agent` 是否使用 session targets。
- `shell_command`、`apply_patch` 是否需要 resolver 提供明确 payload。

### codex-memory-*

检查：

- checkpoint content 是否不包含敏感信息。
- recall query 是否稳定。
- recall miss 是否按配置处理。
- MCP client 是否正确处理 initialize、session header、tools/call 和 JSON-RPC error。

### observability

检查：

- fanout 默认 `fail_fast` 是否符合场景。
- best-effort 是否吞掉非关键 sink failure。
- timeout / retry metrics 是否正确累计。
- alert threshold 是否用 `>` 还是 `>=`，避免误判。
- delivery window 是否正确 dedupe / cooldown。

## 测试建议

### 低风险

适用：

- docs。
- 注释。
- README。

建议：

```text
npm run typecheck
```

### 中风险

适用：

- 单个策略模块。
- intent / approval / recon policy 小改。

建议：

```text
npm run typecheck
npm test
```

并补对应模块测试。

### 高风险

适用：

- `contracts`
- `routing-policy.yaml`
- `desktop-decision-runner`
- `desktop-live-adapter`

建议：

```text
npm run typecheck
npm test
```

还要补 blocked path 和 failure path 测试。

### 很高风险

适用：

- 宿主 bridge。
- memory MCP。
- telemetry fanout。
- release gating。
- primitive schema。

建议：

- 全量类型检查。
- 全量测试。
- 新增端到端场景测试。
- 明确验证失败路径、阻断路径和恢复路径。

## Review 时的核心问题

每个改动都应回答这些问题：

- 这个改动是否改变 task class、tool access 或 approval 行为？
- 是否可能让高风险任务走低风险路径？
- 是否影响 release / protected remote 的阻断能力？
- 是否影响 memory / telemetry 的强制要求？
- 是否影响 checkpoint、audit 或 resume 的证据链？
- 是否影响宿主 runtime 的假设？
- 是否有 blocked path 测试，而不只是 happy path？

## 最简维护心智模型

```text
用户任务
  -> 识别风险
  -> 套用策略
  -> 生成执行计划
  -> 执行宿主原语
  -> 留下检查点 / 审计 / 遥测
  -> 必要时恢复继续
```

维护这个仓库时，核心不是只保证代码能运行，而是保证这条治理链没有被削弱。
