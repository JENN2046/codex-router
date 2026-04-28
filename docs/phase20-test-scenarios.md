# Phase 20: 真实宿主测试场景 (CLI-only)

> 生成时间: 2026-04-28
> Desktop 路径因 final-host-source-gate 阻塞，本文件只覆盖 CLI host

## 场景矩阵

| 场景 ID | 宿主 | 风险级别 | 操作类型 | 治理验证点 | 预计耗时 |
|---------|------|---------|---------|-----------|---------|
| CANARY-01 | CLI | low | read-only | 全治理闭环 (state → risk → route → checkpoint → observe) | <5s |
| CANARY-02 | CLI | medium | workspace-write | 策略升级 + irreversible action 检测 | <10s |
| CANARY-03 | CLI | high | external-write | 仲裁触发 + step-back | <15s |
| SMOKE-01 | CLI | low | read-only | governance state 快速创建 + telemetry | <3s |
| SMOKE-02 | CLI | medium | workspace-write | 策略路由 + observation + telemetry | <5s |

## CANARY-01: CLI Read-only 全闭环

**目的**: 验证 DGP 治理在 CLI 宿主上的完整生命周期

**步骤**:
1. 加载 `routing-policy.yaml`
2. 构造 `taskId: canary-{timestamp}`, `source: cli`, `intent: read-only`
3. 调用 `runDesktopDecisionWithGovernance()` → governance state 创建
4. 验证 `result.governanceState.risk.finalRiskLevel === "low"`
5. 验证 `result.strategyDecision.actionFamily === "execute"`
6. Persist checkpoint → `FileCheckpointLedgerStore.record()`
7. Persist observation → `FileExecutionObservationStore.emit()`
8. 读取验证 persistence 成功
9. 写入 evidence JSON 到 `docs/evidence/codex-cli-canary-latest.json`

**验收标准**: evidence 中 `status: passed`, `governancePhase` 非空, `riskLevel: low`, `checkpointPersisted: true`, `observationPersisted: true`

## CANARY-02: CLI Workspace-Write 策略升级

**目的**: 验证中等风险任务触发策略升级

**步骤**:
1. 加载 `routing-policy.yaml`
2. 构造 `taskId: canary-write-{timestamp}`, `source: cli`, `intent: workspace-write`, `riskHints: ["file_write"]`
3. 调用 `runDesktopDecisionWithGovernance()`
4. 验证 `result.governanceState.risk.finalRiskLevel !== "low"`（应为 medium 或 high）
5. 验证 `result.strategyDecision.verificationIntensity !== "light"`
6. 验证 checkpoint 中 `irreversibleActions.length > 0`
7. 写入 evidence

**验收标准**: evidence 中 `riskLevel: medium|high`, `verificationIntensity: moderate|strict`

## CANARY-03: CLI External-Write 仲裁触发

**目的**: 验证高风险外部写入触发仲裁机制

**步骤**:
1. 加载 `routing-policy.yaml`
2. 构造 `taskId: canary-extwrite-{timestamp}`, `source: cli`, `intent: external-write`, `riskHints: ["external_api", "production"]`
3. 调用 `runDesktopDecisionWithGovernance()`
4. 验证 `result.governanceState.risk.finalRiskLevel === "high"` 或 `"critical"`
5. 验证 strategy decision 包含 step-back 或 arbitration 动作
6. 写入 evidence

**验收标准**: evidence 中 `riskLevel: high|critical`, `requiresArbitration: true`

## SMOKE-01: CLI Read-only Smoke (已有)

已有脚本: `scripts/run-codex-cli-readonly-smoke-telemetry.ts`
npm script: `smoke:telemetry`

**验收**: telemetry cache miss → warm → hit 循环通过

## SMOKE-02: CLI Workspace-Write Smoke (已有)

已有脚本: `scripts/run-codex-cli-workspace-write-smoke-telemetry.ts`
npm script: `smoke:workspace-write:telemetry`

**验收**: write smoke + telemetry 通过

## 证据输出规范

所有 canary/smoke 脚本输出统一的 evidence schema:

```json
{
  "schemaVersion": "codex-router-evidence.v1",
  "generatedAt": "ISO8601",
  "phase": "phase20",
  "scenarioId": "CANARY-01",
  "host": "cli",
  "status": "passed|failed|blocked",
  "result": {
    "taskId": "...",
    "governancePhase": "...",
    "riskLevel": "...",
    "actionFamily": "...",
    "verificationIntensity": "...",
    "checkpointPersisted": true,
    "observationPersisted": true
  },
  "artifacts": ["docs/evidence/codex-cli-canary-latest.json"]
}
```

## CLI 运行时要求

- Node.js >= 20
- `routing-policy.yaml` 存在于仓库根目录
- 文件系统可写（用于 checkpoint/observation/evidence 持久化）
- 不需要 Codex CLI binary（governance 层纯 SDK 验证）
