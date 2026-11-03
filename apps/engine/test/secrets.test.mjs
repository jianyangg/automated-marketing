import test from "node:test";
import assert from "node:assert/strict";
import { readSecret, writeSecret } from "../secrets.mjs";

// Simulates `security` failing the way Node reports it: the error message
// echoes the full command line, including the secret value.
const failing = (_command, args) => {
  throw new Error(`Command failed: security ${args.join(" ")}`);
};

test("a failed Keychain write never echoes the secret", () => {
  const error = (() => {
    try {
      writeSecret("brand/threads", { userId: "42", accessToken: "tok_SECRET_9f3" }, { run: failing });
    } catch (caught) {
      return caught;
    }
  })();
  assert.equal(error.code, "keychain_write_failed");
  assert.doesNotMatch(`${error.message} ${error.stack}`, /tok_SECRET_9f3/);
});

test("reading a missing or malformed secret gives an actionable error without the value", () => {
  assert.throws(() => readSecret("brand/threads", { run: failing }), { code: "missing_secret" });
  assert.throws(() => readSecret("brand/threads", { run: () => "not json token-123" }), (error) => {
    assert.equal(error.code, "invalid_secret");
    assert.doesNotMatch(error.message, /token-123/);
    return true;
  });
  assert.deepEqual(readSecret("brand/threads", { run: () => '{"userId":"1","accessToken":"a"}\n' }), {
    userId: "1",
    accessToken: "a",
  });
});
