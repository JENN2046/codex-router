import { DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL } from "../packages/codex-cli-host/src/index.js";

process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_MODE = "read-only";
process.env.CODEX_CLI_OPERATOR_ACCEPTANCE_MODEL ??= DEFAULT_CODEX_CLI_MODEL_PROBE_MODEL;

await import("./run-codex-cli-operator-acceptance.js");
