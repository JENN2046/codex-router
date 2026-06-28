# Desktop Live Recovery Result Contract

> Date: 2026-04-28
> Scope: Phase 21.4 Recovery result contract
> Status: implemented and validated

## Summary

`DesktopLiveExecutionResult` now exposes an optional `governance` field when
runtime governance forces recovery through `step_back` or `abort`.

The field is optional for backward compatibility. Callers that only read
`status`, `steps`, and `blockingReasons` continue to work unchanged.

## Shape

```ts
interface DesktopLiveExecutionGovernance {
  state: GovernanceState;
  strategyDecision: StrategyDecisionV2;
  arbitrationPacket: ArbitrationPacket;
  availableRecoveryActions: RecoveryAction[];
  recoveryRequired: boolean;
  lockdown: boolean;
}
```

## Host Display Guidance

When `executionResult.governance` is present, hosts can display:

- `governance.arbitrationPacket.trigger`
- `governance.arbitrationPacket.rawEvidenceRefs`
- `governance.arbitrationPacket.conflictingSignals`
- `governance.availableRecoveryActions`
- `governance.strategyDecision.reasons`
- `governance.state.anomalies`

Runtime live adapter recovery packets use
`execution-observation:<observationId>` refs when an observation bus
successfully records the failure observation. Absence of `rawEvidenceRefs`
means no observation bus was provided or no failure observation was
successfully emitted.

`governance.lockdown === true` means the adapter has stopped execution and
requires arbitration before continuing. The result also preserves the existing
blocking reasons:

```ts
["governance_step_back_triggered", "arbitration_required"]
```

For future `abort` strategy paths, the adapter uses:

```ts
["governance_abort_triggered", "arbitration_required"]
```

## Non-Recovery Results

The `governance` field is omitted for:

- blocked preflight without runtime execution
- telemetry gating without governance state
- normal primitive failures that do not route to `step_back` or `abort`
- successful execution

This keeps the contract small: hosts only need to branch on
`executionResult.governance` when a recovery workflow is actually required.
