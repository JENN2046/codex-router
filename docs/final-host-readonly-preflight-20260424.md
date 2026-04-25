# Final Host Read-Only Preflight (2026-04-24)

## Scope

This note records the read-only discovery pass before wiring `codex-router` into
the final Codex Desktop host.

No host process was stopped or restarted. No host repository files were edited.

## Current Finding

- `A:\codex-router` is the SDK and integration-prep workspace.
- No editable Codex Desktop source repository was found in the local workspace
  paths checked during this pass.
- An installed Codex app package exists at
  `C:\Users\617\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0`.
- Treat the installed package as a packaged runtime, not as an editable source
  tree.
- `A:\VCP\VCPChat`, `A:\VCP\VCPChat_native_host`, and
  `A:\VCP\VCPChat_postmerge_main` contain useful prior native-host integration
  seams.
- Treat VCPChat as a reference and validation host, not as the final Codex
  Desktop host unless that is explicitly re-scoped.

## Reference Host Seams

The VCPChat trees show the shape of a working host-side bridge:

- `A:\VCP\VCPChat\modules\services\codexRouterHost.js`
- `A:\VCP\VCPChat\modules\ipc\desktopRemoteHandlers.js`
- `A:\VCP\VCPChat\preloads\desktop.js`
- `A:\VCP\VCPChat\preloads\chat.js`
- `A:\VCP\VCPChat\renderer.js`

These files are reference material only for the final host pass. They should not
be edited as part of final Codex Desktop integration without a separate scope
decision.

## Required Final Host Inputs

Before implementation can start in the final host, we still need:

- the editable final Codex Desktop host source path, plugin path, or extension
  surface;
- the main-process, extension-host, or equivalent startup seam where
  `createCodexDesktopLiveHostEmbeddingStarter()` can be instantiated;
- the final host's runtime methods for task creation, memory access, chat/event
  emission, and approval flow;
- the host-side location where smoke evidence from
  `createCodexDesktopLiveHostSmokeEvidence()` should be persisted or displayed;
- the validation command or manual smoke path for that final host.

## Next Safe Gate

Do not wire into the final host until the editable source or supported extension
surface is identified.

Once the final host source is available, the first narrow pass should be:

1. inspect the host startup and IPC/plugin boundaries;
2. map host runtime methods to the `codex-desktop-live-host` starter contract;
3. add a read-only smoke command or menu action first;
4. run smoke evidence capture without mutating user data;
5. only then consider write-capable task execution.

This keeps the current running host unaffected and preserves VCPChat as a known
reference path rather than accidentally turning it into the final integration
target.
