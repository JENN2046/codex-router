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
    redactSecretLikeText(`{"access_token":"compound-token","client_secret":"compound-secret","safe":"ok"}`),
    `{"access_token":"<REDACTED_SECRET>","client_secret":"<REDACTED_SECRET>","safe":"ok"}`
  );
  assert.equal(
    redactSecretLikeText(`{"session":"json-session","safe":"ok"}`, ["session"]),
    `{"session":"<REDACTED_SECRET>","safe":"ok"}`
  );
  assert.equal(
    redactSecretLikeText("tool --session=string-session", ["session"]),
    "tool --session=<REDACTED_SECRET>"
  );
  assert.equal(
    redactSecretLikeText(`tool --token="quoted token value"`),
    `tool --token="<REDACTED_SECRET>"`
  );
  assert.equal(
    redactSecretLikeText("tool --session='quoted session value'", ["session"]),
    "tool --session='<REDACTED_SECRET>'"
  );
  assert.equal(
    redactSecretLikeText("tool --token split-token --safe ok"),
    "tool --token <REDACTED_SECRET> --safe ok"
  );
  assert.equal(
    redactSecretLikeText("tool --token split\\ token --safe ok"),
    "tool --token <REDACTED_SECRET> --safe ok"
  );
  assert.equal(
    redactSecretLikeText("tool --token -string-token --safe ok"),
    "tool --token <REDACTED_SECRET> --safe ok"
  );
  assert.equal(
    redactSecretLikeText("tool --token --string-token --safe ok"),
    "tool --token <REDACTED_SECRET> --safe ok"
  );
  assert.equal(
    redactSecretLikeText("tool --token=inline\\ token --safe ok"),
    "tool --token=<REDACTED_SECRET> --safe ok"
  );
  assert.equal(
    redactSecretLikeText(`tool --session "split session value" --safe ok`, ["session"]),
    `tool --session "<REDACTED_SECRET>" --safe ok`
  );
  assert.equal(
    redactSecretLikeText("tool --token --password real-password --safe ok"),
    "tool --token --password <REDACTED_SECRET> --safe ok"
  );
  assert.equal(
    redactSecretLikeText("tool --token --github-token real-github-token --safe ok"),
    "tool --token --github-token <REDACTED_SECRET> --safe ok"
  );
  assert.equal(
    redactSecretLikeText("tool --token --github-token --dash-github-token --safe ok"),
    "tool --token --github-token <REDACTED_SECRET> --safe ok"
  );
  assert.equal(
    redactSecretLikeText("tool --token --refresh-token real-refresh-token --safe ok"),
    "tool --token --refresh-token <REDACTED_SECRET> --safe ok"
  );
  assert.equal(
    redactSecretLikeText("tool --token --refresh-token --dash-refresh-token --safe ok"),
    "tool --token --refresh-token <REDACTED_SECRET> --safe ok"
  );
  assert.equal(
    redactSecretLikeText("tool --token --secret-value value-after-opaque --safe ok"),
    "tool --token <REDACTED_SECRET> value-after-opaque --safe ok"
  );
  assert.deepEqual(
    redactSecretLikeArgv([
      "exec",
      "--token",
      "-argv-token",
      "--password",
      "-argv-password",
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
    redactSecretLikeArgv([
      "exec",
      "--token",
      "--github-token",
      "--dash-github-token",
      "--refresh-token",
      "--dash-refresh-token",
      "--safe",
      "ok"
    ]),
    [
      "exec",
      "--token",
      "--github-token",
      "<REDACTED_SECRET>",
      "--refresh-token",
      "<REDACTED_SECRET>",
      "--safe",
      "ok"
    ]
  );
  assert.deepEqual(
    redactSecretLikeArgv([
      "exec",
      "--token",
      "--secret-value",
      "value-after-opaque",
      "--safe",
      "ok"
    ]),
    [
      "exec",
      "--token",
      "<REDACTED_SECRET>",
      "value-after-opaque",
      "--safe",
      "ok"
    ]
  );
  assert.deepEqual(
    redactSecretLikeArgv([
      "exec",
      "--token",
      "-secret-value"
    ]),
    [
      "exec",
      "--token",
      "<REDACTED_SECRET>"
    ]
  );
  assert.deepEqual(
    redactSecretLikeArgv([
      "exec",
      "--token",
      "--secret-value"
    ]),
    [
      "exec",
      "--token",
      "<REDACTED_SECRET>"
    ]
  );
  assert.deepEqual(
    redactSecretLikeArgv([
      "exec",
      "--token",
      "--password",
      "-real-password",
      "--safe",
      "ok"
    ]),
    [
      "exec",
      "--token",
      "--password",
      "<REDACTED_SECRET>",
      "--safe",
      "ok"
    ]
  );
  assert.deepEqual(
    redactSecretLikeArgv([
      "exec",
      "--token",
      "--github-token",
      "real-github-token",
      "--refresh-token",
      "real-refresh-token",
      "--safe",
      "ok"
    ]),
    [
      "exec",
      "--token",
      "--github-token",
      "<REDACTED_SECRET>",
      "--refresh-token",
      "<REDACTED_SECRET>",
      "--safe",
      "ok"
    ]
  );
  assert.deepEqual(
    redactSecretLikeFields({
      command: `tool --token --string-token --safe ok`,
      payload: `{"access_token":"preview-token","safe":"visible"}`,
      args: ["--token", "-argv-token"],
      nested: {
        apiKey: "field-api-key"
      }
    }, {
      redactArgvSecrets: true,
      redactStrings: true
    }),
    {
      command: `tool --token <REDACTED_SECRET> --safe ok`,
      payload: `{"access_token":"<REDACTED_SECRET>","safe":"visible"}`,
      args: ["--token", "<REDACTED_SECRET>"],
      nested: {
        apiKey: "<REDACTED_SECRET>"
      }
    }
  );
});
