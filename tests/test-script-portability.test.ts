import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { planTestRuns } from "../scripts/run-tests.js";

const execFileAsync = promisify(execFile);

test("package test runner isolates the nested clean-build workload", () => {
  assert.deepEqual(planTestRuns([
    "/repo/tests/authorization-kernel.test.ts",
    "/repo/tests/clean-build-determinism.test.ts",
    "/repo/tests/public-api-surface.test.ts"
  ]), [
    {
      mode: "parallel",
      files: [
        "/repo/tests/authorization-kernel.test.ts",
        "/repo/tests/public-api-surface.test.ts"
      ]
    },
    {
      mode: "isolated",
      files: ["/repo/tests/clean-build-determinism.test.ts"]
    }
  ]);
});

test("package test script discovers files without shell glob expansion", async (context) => {
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8")
  ) as { scripts?: { test?: string } };
  assert.equal(packageJson.scripts?.test, "node --import tsx scripts/run-tests.ts");

  const fixtureRoot = await mkdtemp(join(tmpdir(), "codex-router-test-glob-"));
  context.after(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });
  await writeFile(
    join(fixtureRoot, "literal glob.test.ts"),
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
  await writeFile(
    join(fixtureRoot, "ignored.ts"),
    "throw new Error('non-test file executed');\n",
    "utf8"
  );

  const runnerPath = fileURLToPath(new URL("../scripts/run-tests.ts", import.meta.url));
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  const childEnv: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: "0" };
  delete childEnv.NODE_TEST_CONTEXT;
  const { stdout, stderr } = await execFileAsync(
    process.execPath,
    ["--import", "tsx", runnerPath, fixtureRoot],
    {
      cwd: repoRoot,
      env: childEnv,
      windowsHide: true
    }
  );

  assert.match(`${stdout}\n${stderr}`, /literal glob reached test body/);
});
