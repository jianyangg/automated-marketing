import test from "node:test";
import assert from "node:assert/strict";
import { markdownBlocks } from "../public/markdown-model.mjs";
import { inlineParts } from "../public/text.mjs";

test("reports become tables, lists and fenced code rather than raw Markdown paragraphs", () => {
  const blocks = markdownBlocks(
    '# Results\n\n| Effort | Result |\n| --- | --- |\n| Launch | Unknown |\n\n- First\n- Second\n\n1. Review\n2. Decide\n\n```json\n{"value": 0}\n```\n\n> Not yet measured.',
  );
  assert.deepEqual(
    blocks.map((b) => b.type),
    ["heading", "table", "list", "list", "code", "quote"],
  );
  assert.deepEqual(blocks[1].rows, [["Launch", "Unknown"]]);
  assert.equal(blocks[3].ordered, true);
  assert.equal(blocks[4].text, '{"value": 0}');
});

test("preserves HTML as inert text while recognizing emphasis, inline code and escaped table pipes", () => {
  assert.deepEqual(
    inlineParts("**Evidence** and `count`").map((p) => p.type),
    ["strong", "text", "code"],
  );
  const blocks = markdownBlocks(
    "| A | B |\n| --- | --- |\n| x \\| y | <img src=x onerror=alert(1)> |",
  );
  assert.equal(blocks[0].rows[0][0], "x | y");
  assert.match(blocks[0].rows[0][1], /<img/);
});
