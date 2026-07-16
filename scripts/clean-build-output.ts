#!/usr/bin/env node

import { lstat, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_PACKAGE_NAME = "codex-router";
const BUILD_OUTPUT_DIRECTORY = "dist";

export interface CleanBuildOutputResult {
  status: "cleaned";
  target: "dist";
  existed: boolean;
}

export async function cleanBuildOutput(
  repositoryRoot = process.cwd()
): Promise<CleanBuildOutputResult> {
  const root = resolve(repositoryRoot);
  const packageJson = await readJsonObject(
    resolve(root, "package.json"),
    "clean_build_package_json_invalid"
  );
  if (packageJson.name !== EXPECTED_PACKAGE_NAME) {
    throw new Error("clean_build_repository_identity_mismatch");
  }

  const tsconfig = await readJsonObject(
    resolve(root, "tsconfig.json"),
    "clean_build_tsconfig_invalid"
  );
  const compilerOptions = asRecord(tsconfig.compilerOptions);
  if (compilerOptions === undefined || typeof compilerOptions.outDir !== "string") {
    throw new Error("clean_build_outdir_missing");
  }

  const target = resolve(root, compilerOptions.outDir);
  const expectedTarget = resolve(root, BUILD_OUTPUT_DIRECTORY);
  if (target !== expectedTarget) {
    throw new Error("clean_build_outdir_mismatch");
  }

  let existed = false;
  try {
    const targetStat = await lstat(target);
    existed = true;
    if (targetStat.isSymbolicLink()) {
      throw new Error("clean_build_outdir_symlink_rejected");
    }
    if (!targetStat.isDirectory()) {
      throw new Error("clean_build_outdir_not_directory");
    }
  } catch (error) {
    if (!isMissingPathError(error)) {
      throw error;
    }
  }

  await rm(target, { recursive: true, force: true });
  return {
    status: "cleaned",
    target: BUILD_OUTPUT_DIRECTORY,
    existed
  };
}

async function readJsonObject(
  path: string,
  invalidReason: string
): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    const record = asRecord(parsed);
    if (record === undefined) {
      throw new Error(invalidReason);
    }
    return record;
  } catch (error) {
    if (error instanceof Error && error.message === invalidReason) {
      throw error;
    }
    throw new Error(invalidReason);
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}

async function main(): Promise<void> {
  const result = await cleanBuildOutput();
  console.log(JSON.stringify(result));
}

if (process.argv[1] !== undefined) {
  const invoked = resolve(process.argv[1]);
  const current = resolve(fileURLToPath(import.meta.url));
  if (invoked === current) {
    await main().catch((error: unknown) => {
      const reason = error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)
        ? error.message
        : "clean_build_unknown_error";
      console.error(reason);
      process.exitCode = 1;
    });
  }
}
