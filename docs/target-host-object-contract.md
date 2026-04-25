# Target Host Object Contract

`packages/host-client-example/src/target-host-object-contract.ts` is the
copyable contract template for a real embedding repo before live wiring begins.

Use it when you want a typed host object scaffold that:

- mirrors the current `CodexDesktopLiveHostObject` contract
- inserts explicit placeholder methods for any unwired required hook
- reports unwired methods before the first live bundle is created

## Main Entry

- `createCodexDesktopTargetHostObjectContract()`
- `inspectCodexDesktopTargetHostObjectContract()`
- `assertCodexDesktopTargetHostObjectContract()`
- `getCodexDesktopTargetHostPlaceholderMethods()`

It also exports the current method lists:

- `CODEX_DESKTOP_TARGET_HOST_REQUIRED_RUNTIME_METHODS`
- `CODEX_DESKTOP_TARGET_HOST_REQUIRED_MEMORY_METHODS`
- `CODEX_DESKTOP_TARGET_HOST_OPTIONAL_MEMORY_METHODS`

## What This File Is For

The core live-host package already knows how to inspect or fail on missing
methods.

This contract template adds the next layer up for real embedding work:

- a scaffold object you can start from in the target host repo
- explicit placeholder methods that throw
  `codex_desktop_target_host_contract_method_not_wired:...`
- a contract-level assertion that also fails on unwired placeholders, not just
  missing keys

## Minimal Shape

```ts
import {
  createCodexDesktopTargetHostObjectContract,
  inspectCodexDesktopTargetHostObjectContract
} from "../packages/host-client-example/src/index.js";

const host = createCodexDesktopTargetHostObjectContract({
  read_thread_terminal() {
    return read_thread_terminal();
  },
  spawn_agent(input) {
    return spawn_agent(input);
  },
  wait_agent(input) {
    return wait_agent(input);
  },
  send_input(input) {
    return send_input(input);
  },
  close_agent(input) {
    return close_agent(input);
  },
  shell_command(input) {
    return shell_command(input);
  },
  apply_patch(patch) {
    return apply_patch(patch);
  },
  automation_update(input) {
    return automation_update(input);
  },
  record_memory(input) {
    return record_memory(input);
  },
  search_memory(input) {
    return search_memory(input);
  }
});

const inspection = inspectCodexDesktopTargetHostObjectContract(host);
```

## Recommended Use

- start with `createCodexDesktopTargetHostObjectContract()`
- wire the real host methods one by one
- run `inspectCodexDesktopTargetHostObjectContract()` as a readiness check
- only then pass the host into `createCodexDesktopTargetHostLayerSkeleton()`

`target-host-layer-skeleton` now calls
`assertCodexDesktopTargetHostObjectContract()` before bundle creation, so a
partially wired template fails fast with
`codex_desktop_target_host_contract_unwired_methods:...`.
