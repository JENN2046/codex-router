import test from "node:test";
import assert from "node:assert/strict";
import {
  collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput,
  formatWorkspaceWriteRealCanaryAuthorizationDesignAuditResult,
  reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit
} from "../scripts/run-workspace-write-real-canary-authorization-design-audit.js";

const forbiddenOutputMarkers = [
  "OPENAI_API_KEY",
  "sk-proj-",
  "Bearer "
];

test("workspace-write real canary authorization design audit passes current design", async () => {
  const review = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit(
    await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput()
  );

  assert.equal(review.status, "passed");
  assert.deepEqual(review.reasons, []);
  assert.equal(review.checks.governanceRunnerRegistered, true);
  assert.equal(review.checks.governanceReadmeListsAudit, true);
  assert.equal(review.checks.currentStateListsAudit, true);
  assert.equal(review.checks.designDocRecorded, true);
  assert.equal(review.checks.releaseGateBindingRecorded, true);
  assert.equal(review.checks.runbookBindingRecorded, true);
  assert.equal(review.checks.permitV2BindingRecorded, true);
  assert.equal(review.checks.fakeCanaryV2BindingRecorded, true);
  assert.equal(review.checks.preExecutionChecksRecorded, true);
  assert.equal(review.checks.evidencePolicyAligned, true);
  assert.equal(review.checks.threatModelAligned, true);
  assert.equal(review.checks.implementationAnchorsRecorded, true);
  assert.equal(review.checks.acceptanceCoverageRecorded, true);
  assert.equal(review.checks.noBroadAuthorizationText, true);
  assert.equal(review.checks.noRuntimeInvocationSurface, true);
  assert.equal(review.summary.designMode, "real_canary_authorization_design_only");
  assert.equal(
    review.summary.packetSchemaVersion,
    "workspace-write-real-canary-authorization-packet.v1"
  );
  assert.equal(review.summary.realCanaryDefault, "blocked");
  assert.equal(review.summary.generalWorkspaceWriteDefault, "blocked");
  assert.equal(review.summary.designIsWorkspaceWriteAuthorization, false);
  assert.equal(review.summary.designIsRealCodexCliAuthorization, false);
  assert.equal(review.summary.designIsProviderExecutionAuthorization, false);
  assert.equal(review.summary.designIsHostExecutorAuthorization, false);
  assert.equal(review.summary.designIsSubAgentRuntimeAuthorization, false);
  assert.equal(review.summary.designIsExternalWriteAuthorization, false);
  assert.equal(review.summary.designIsPushAuthorization, false);
  assert.equal(review.summary.designIsReleaseAuthorization, false);
  assert.equal(review.summary.providerExecuteCallsDuringAudit, 0);
  assert.equal(review.summary.workspaceWriteCallsDuringAudit, 0);
  assert.equal(review.summary.canaryFileWritesDuringAudit, 0);
  assert.equal(review.summary.evidenceWritesDuringAudit, 0);
});

test("workspace-write real canary authorization design audit blocks broadened packet", async () => {
  const input = await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput();
  const review = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit({
    ...input,
    designDocText: input.designDocText
      .replace("`pushAuthorized`: `false`", "`pushAuthorized`: `true`")
      .replace("`branchPolicy`: `non_main_non_protected_branch_only`", "`branchPolicy`: `main`")
      .replace("It is not the real canary execution itself.", "Run the real canary now.")
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_real_canary_authorization_design_designDocRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "workspace_write_real_canary_authorization_design_noBroadAuthorizationText"
    )
  );
});

test("workspace-write real canary authorization design audit blocks release-side effects", async () => {
  const input = await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput();

  for (const field of [
    "tagAuthorized",
    "deploymentAuthorized",
    "packagePublishAuthorized"
  ]) {
    const review = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit({
      ...input,
      designDocText: input.designDocText.replace(
        `\`${field}\`: \`false\``,
        `\`${field}\`: \`true\``
      )
    });

    assert.equal(review.status, "blocked", `${field} must stay false`);
    assert.ok(
      review.reasons.includes(
        "workspace_write_real_canary_authorization_design_designDocRecorded"
      )
    );
  }
});

test("workspace-write real canary authorization design audit blocks missing permit v2", async () => {
  const input = await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput();
  const review = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit({
    ...input,
    designDocText: input.designDocText.replaceAll(
      "provider-workspace-write-execution-permit.v2",
      "provider-workspace-write-execution-permit.v1"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_real_canary_authorization_design_permitV2BindingRecorded"
    )
  );
});

test("workspace-write real canary authorization design audit blocks missing preflight", async () => {
  const input = await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput();
  const review = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit({
    ...input,
    designDocText: input.designDocText.replace(
      "current branch is not `main`",
      "current branch is reviewed"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_real_canary_authorization_design_preExecutionChecksRecorded"
    )
  );
  assert.ok(
    review.reasons.includes(
      "workspace_write_real_canary_authorization_design_threatModelAligned"
    )
  );
});

test("workspace-write real canary authorization design audit blocks missing registration", async () => {
  const input = await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput();
  const review = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit({
    ...input,
    governanceRunnerText: input.governanceRunnerText.replaceAll(
      "workspace-write-real-canary-authorization-design",
      "workspace-write-real-canary-design"
    ),
    governanceReadmeText: input.governanceReadmeText.replaceAll(
      "npm run governance -- audit workspace-write-real-canary-authorization-design",
      "npm run governance -- audit workspace-write-real-canary-design"
    ),
    currentStateText: input.currentStateText.replaceAll(
      "npm run governance -- audit workspace-write-real-canary-authorization-design",
      "npm run governance -- audit workspace-write-real-canary-design"
    )
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_real_canary_authorization_design_governanceRunnerRegistered"
    )
  );
  assert.ok(
    review.reasons.includes(
      "workspace_write_real_canary_authorization_design_governanceReadmeListsAudit"
    )
  );
  assert.ok(
    review.reasons.includes(
      "workspace_write_real_canary_authorization_design_currentStateListsAudit"
    )
  );
});

test("workspace-write real canary authorization design audit blocks runtime markers", async () => {
  const input = await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput();
  const review = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit({
    ...input,
    designDocText: `${input.designDocText}\n\nprovider.execute({});\n`
  });

  assert.equal(review.status, "blocked");
  assert.ok(
    review.reasons.includes(
      "workspace_write_real_canary_authorization_design_noRuntimeInvocationSurface"
    )
  );
});

test("workspace-write real canary authorization design audit blocks runtime markers in linked authority docs", async () => {
  const input = await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput();
  const authorityMutations = [
    {
      name: "release gate",
      input: {
        ...input,
        releaseGateText: `${input.releaseGateText}\n\nprovider.execute({});\n`
      }
    },
    {
      name: "runbook",
      input: {
        ...input,
        runbookText: `${input.runbookText}\n\nprovider.execute({});\n`
      }
    },
    {
      name: "evidence policy",
      input: {
        ...input,
        evidencePolicyText: `${input.evidencePolicyText}\n\nprovider.execute({});\n`
      }
    },
    {
      name: "threat model",
      input: {
        ...input,
        threatModelText: `${input.threatModelText}\n\nprovider.execute({});\n`
      }
    }
  ];

  for (const mutation of authorityMutations) {
    const review = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit(
      mutation.input
    );

    assert.equal(review.status, "blocked", mutation.name);
    assert.ok(
      review.reasons.includes(
        "workspace_write_real_canary_authorization_design_noRuntimeInvocationSurface"
      )
    );
  }
});

test("workspace-write real canary authorization design audit enforces forbidden evidence section", async () => {
  const input = await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput();
  const allowedRawEvidence = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit({
    ...input,
    designDocText: input.designDocText.replace(
      "- patch digest;",
      "- patch digest;\n- raw patch body;"
    )
  });
  const renamedForbiddenSection = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit({
    ...input,
    designDocText: input.designDocText.replace(
      "Forbidden evidence:",
      "Disallowed evidence:"
    )
  });

  for (const review of [allowedRawEvidence, renamedForbiddenSection]) {
    assert.equal(review.status, "blocked");
    assert.ok(
      review.reasons.includes(
        "workspace_write_real_canary_authorization_design_evidencePolicyAligned"
      )
    );
  }
});

test("workspace-write real canary authorization design audit output stays summarized", async () => {
  const review = reviewWorkspaceWriteRealCanaryAuthorizationDesignAudit(
    await collectWorkspaceWriteRealCanaryAuthorizationDesignAuditInput()
  );
  const text = formatWorkspaceWriteRealCanaryAuthorizationDesignAuditResult(review);
  const json = formatWorkspaceWriteRealCanaryAuthorizationDesignAuditResult(
    review,
    "json"
  );
  const parsed = JSON.parse(json) as typeof review;

  assert.match(text, /status: passed/);
  assert.match(text, /design mode: real_canary_authorization_design_only/);
  assert.match(text, /design is workspace-write authorization: false/);
  assert.match(text, /workspace-write calls during audit: 0/);
  assert.equal(parsed.status, "passed");

  for (const marker of forbiddenOutputMarkers) {
    assert.equal(text.includes(marker), false, `text output must omit ${marker}`);
    assert.equal(json.includes(marker), false, `json output must omit ${marker}`);
  }
});
