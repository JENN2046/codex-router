import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

test("package test script expands test globs without shell assistance", async (context) => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  ) as { scripts?: { test?: string } };
  assert.equal(packageJson.scripts?.test, "tsx --test tests/*.test.ts");

  const fixtureRoot = await mkdtemp(join(tmpdir(), "codex-router-test-glob-"));
  context.after(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });
  await writeFile(
    join(fixtureRoot, "literal-glob.test.ts"),
    [
      'import test from "node:test";',
      'import assert from "node:assert/strict";',
      '',
      'test("literal glob reached test body", () => {',
      '  const value: string = "expanded";',
      '  assert.equal(value, "expanded");',
      '});',
      ''
    ].join("\n"),
    "utf8"
  );

  const tsxCliPath = fileURLToPath(import.meta.resolve("tsx/cli"));
  const childEnv: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: "0" };
  delete childEnv.NODE_TEST_CONTEXT;
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    [tsxCliPath, "--test", "*.test.ts"],
    {
      cwd: fixtureRoot,
      env: childEnv,
      windowsHide: true
    }
  );

  assert.match(`${stdout}\n${stderr}`, /literal glob reached test body/);
});
