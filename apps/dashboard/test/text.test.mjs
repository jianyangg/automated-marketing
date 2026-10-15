import test from "node:test";
import assert from "node:assert/strict";
import { inlineParts, dateLabel } from "../public/text.mjs";

test("keeps imported HTML as text and refuses executable link schemes", () => {
  const parts = inlineParts(
    "<script>alert(1)</script> [open](javascript:alert) [image](data:text/html,bad)",
  );
  assert.equal(parts[0].type, "text");
  assert.match(parts[0].text, /<script>/);
  assert.equal(
    parts.some((part) => part.type === "external" || part.type === "record"),
    false,
  );
});

test("distinguishes source-record links and deliberate external links", () => {
  const parts = inlineParts(
    "[Draft](work/draft.md#copy) and [Source](https://example.com/page)",
  );
  assert.deepEqual(parts[0], {
    type: "record",
    text: "Draft",
    target: "work/draft.md",
  });
  assert.deepEqual(parts[2], {
    type: "external",
    text: "Source",
    target: "https://example.com/page",
  });
  assert.equal(inlineParts("[hidden](/absolute.md)")[0].type, "text");
});

test("missing or invalid observation dates are explicitly unknown", () => {
  assert.equal(dateLabel(null), "Not recorded");
  assert.equal(dateLabel("not-a-date"), "Not recorded");
});
