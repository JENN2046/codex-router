# PR-13A Read-only Real CLI Authorization Packet Compatibility

## 1. Purpose

This document records the local-only compatibility check for a future PR-13A
real Codex CLI read-only smoke authorization packet.

It is not a real smoke receipt. It is not an execution authorization,
push-readiness receipt, release note, tag note, workspace-write approval, or
production readiness claim.

## 2. Compatibility Rule

A future real read-only smoke request is compatible only when it exactly
matches the PR-13A gate:

- authorization token:
  `APPROVE_REAL_CODEX_CLI_READONLY_SMOKE_PR_13A`
- command shape:
  `ALLOW_REAL_CODEX_CLI_READONLY_SMOKE=1 npm run smoke:readonly:real`
- sandbox: `read-only`
- approval policy: `never`
- evidence path choice: either `default` or `one-off`
- workspace-write: not authorized
- push: not authorized
- release: not authorized
- tag: not authorized

Any missing, broadened, or side-effect-bearing packet must be rejected before
the real smoke script or provider execution path can run.

## 3. Local Implementation

Added local acceptance script:

- `scripts/run-real-readonly-smoke-authorization-acceptance.ts`

Added package script:

- `npm run governance -- acceptance real-readonly-smoke-auth`

Added test:

- `tests/real-readonly-smoke-authorization-acceptance.test.ts`

Generated local evidence:

- `docs/evidence/codex-cli-real-readonly-smoke-authorization-acceptance.json`

The evaluator is pure local logic. It does not spawn Codex CLI, does not set
`ALLOW_REAL_CODEX_CLI_READONLY_SMOKE`, does not call provider execute, and does
not open workspace-write.

## 4. Rejection Coverage

The local compatibility check covers:

- exact PR-13A token accepted
- exact command shape accepted
- missing token rejected
- missing command rejected
- broadened command rejected
- workspace-write sandbox rejected
- approval policy other than `never` rejected
- missing evidence path choice rejected
- workspace-write authorization rejected
- push authorization rejected
- release authorization rejected
- tag authorization rejected

## 5. Evidence Redaction

The acceptance evidence records only:

- boolean checks
- read-only policy summary
- zero side-effect counters
- reason codes

The evidence must not contain:

- raw authorization token
- raw command
- raw prompt
- raw args
- raw stdout
- raw stderr
- raw task envelope
- raw env
- raw token
- raw patch
- API keys or bearer values

## 6. Validation

Validation observed for this compatibility check:

- `npx tsx --test tests\real-readonly-smoke-authorization-acceptance.test.ts`:
  pass, `5 / 5`
- `npm run governance -- acceptance real-readonly-smoke-auth`: pass
- `npm run typecheck`: pass

Additional validation should be run before local closeout:

- PR-13A related targeted suite
- `npm test`
- `git diff --check`

## 7. Result

Result:

- `PR_13A_READONLY_REAL_CLI_AUTHORIZATION_PACKET_COMPATIBILITY_RECORDED`

PR-13A now has a local fail-closed authorization compatibility check for a
future real read-only Codex CLI smoke. This compatibility check still does not
authorize or run the real smoke.
