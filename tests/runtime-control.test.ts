import test from "node:test";
import assert from "node:assert/strict";
import { upgradeModel } from "../packages/runtime-control/src/index.js";

test("runtime control upgrades codex spark to gpt-5.4-mini before larger models", () => {
  assert.equal(upgradeModel("gpt-5.3-codex-spark"), "gpt-5.4-mini");
  assert.equal(upgradeModel("gpt-5.4-mini"), "gpt-5.3-codex");
  assert.equal(upgradeModel("gpt-5.3-codex"), "gpt-5.4");
  assert.equal(upgradeModel("gpt-5.4"), "gpt-5.1-codex-max");
  assert.equal(upgradeModel("gpt-5.1-codex-max"), "gpt-5.1-codex-max");
});
