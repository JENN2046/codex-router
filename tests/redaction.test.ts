import test from "node:test";
import assert from "node:assert/strict";
import {
  redactSecretLikeArgv,
  redactSecretLikeFields,
  redactSecretLikeText
} from "../packages/redaction/src/index.js";

test("redaction covers text, JSON, and split argv secret values", () => {
  assert.equal(
    redactSecretLikeText(`{"token":"json-token","safe":"ok"}`),
    `{"token":"<REDACTED_SECRET>","safe":"ok"}`
  );
  assert.equal(
    redactSecretLikeText(`{"session":"json-session","safe":"ok"}`, ["session"]),
    `{"session":"<REDACTED_SECRET>","safe":"ok"}`
  );
  assert.equal(
    redactSecretLikeText("tool --session=string-session", ["session"]),
    "tool --session=<REDACTED_SECRET>"
  );
  assert.deepEqual(
    redactSecretLikeArgv([
      "exec",
      "--token",
      "argv-token",
      "--password",
      "argv-password",
      "--api-key=inline-api-key",
      "--session=inline-session",
      "--safe",
      "ok"
    ], ["session"]),
    [
      "exec",
      "--token",
      "<REDACTED_SECRET>",
      "--password",
      "<REDACTED_SECRET>",
      "--api-key=<REDACTED_SECRET>",
      "--session=<REDACTED_SECRET>",
      "--safe",
      "ok"
    ]
  );
  assert.deepEqual(
    redactSecretLikeFields({
      command: "tool --token=string-token",
      args: ["--token", "argv-token"],
      nested: {
        apiKey: "field-api-key"
      }
    }, {
      redactArgvSecrets: true,
      redactStrings: true
    }),
    {
      command: "tool --token=<REDACTED_SECRET>",
      args: ["--token", "<REDACTED_SECRET>"],
      nested: {
        apiKey: "<REDACTED_SECRET>"
      }
    }
  );
});
