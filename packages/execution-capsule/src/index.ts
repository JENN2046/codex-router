/**
 * Internal offline/test-only candidate contract.
 *
 * This module is intentionally absent from package.json public exports. Its
 * receipts are simulated contract evidence and are never permits.
 */
export * from "./contracts.js";
export * from "./content-addressed-store.js";
export * from "./test-only-fake-worker.js";
export * from "./verifier.js";
