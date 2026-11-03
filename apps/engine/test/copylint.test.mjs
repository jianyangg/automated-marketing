import test from "node:test";
import assert from "node:assert/strict";
import { lintCopy } from "../copylint.mjs";

const rules = (text) => lintCopy(text).findings.map((finding) => finding.rule);

test("flags the common machine-writing tells", () => {
  assert.deepEqual(rules("It's the best list — really."), ["em-dash"]);
  assert.ok(rules("It's not just a list, it's a system.").includes("negative-parallelism"));
  assert.ok(rules("A seamless way to unlock your day.").includes("ai-vocabulary"));
  assert.ok(rules("The app serves as your planner.").includes("copula-avoidance"));
  assert.ok(rules("In order to start, open the app.").includes("filler"));
  assert.ok(rules("Let's dive into planning.").includes("signposting"));
  assert.ok(rules("Your roundup is one of the most useful comparisons out there.").includes("flattery"));
  assert.ok(rules("Keep the full list. Choose three for today. Start one.").includes("slogan-triplet"));
  assert.ok(rules("Wow! Great!").includes("exclamations"));
  assert.ok(rules("The point is not the exact numbers but deciding early.").includes("negative-parallelism"));
  assert.ok(rules("Momentum comes from small steps, not from a perfect plan.").includes("tailing-negation"));
});

test("plain, specific copy passes, and findings carry line numbers", () => {
  const plain =
    "We built AikenDewit because our lists kept growing faster than our days.\nYou pick up to three things for today and start one of them.";
  assert.deepEqual(lintCopy(plain), { ok: true, findings: [] });
  const [finding] = lintCopy("Fine line.\nA robust planner.").findings;
  assert.equal(finding.line, 2);
  assert.equal(finding.match.toLowerCase(), "robust");
});

test("a URL on its own does not count as a short sentence", () => {
  assert.ok(lintCopy("Try it. https://example.test/a. Free.").ok);
});
