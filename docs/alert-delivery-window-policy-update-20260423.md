# Alert Delivery Window Policy Update (2026-04-23)

This note records the alert-delivery-window milestone that landed on
2026-04-23 before the broader closeout work continued.

## What Landed

- `policy-config` gained `telemetryAlertDeliveryWindow` schema support
- `routing-policy.yaml` gained four presets:
  - `read_only`
  - `local_write`
  - `engineering`
  - `release`
- `host-client-example` gained:
  - policy-driven alert window preset resolution
  - explicit `telemetryAlertDeliveryWindowPolicy`
  - persisted alert-window state through
    `telemetryAlertDeliveryWindowStorePath`
- `observability` already handled dedupe/cooldown suppression and file-backed
  window-state persistence

## Historical Validation

At the time of this update, the targeted validation slice passed:

- `npx tsx --test tests/policy-config.test.ts tests/observability.test.ts tests/host-client-example.test.ts`
- result: `46/46` passing

## What This Unlocked

- policy-owned dedupe/cooldown defaults instead of host-local constants
- suppression continuity across sessions when the same window-state path is reused
- host-level alert delivery governance without changing the top-level alert sink contract

## Current Reference

For the latest project-wide state after subsequent closeout work, use
[v1-closeout-status-20260423.md](A:/codex-router/docs/v1-closeout-status-20260423.md)
instead of treating this note as the current whole-project summary.
