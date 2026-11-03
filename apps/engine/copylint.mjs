// Flags the mechanical tells that make copy read as machine-written, based on
// Wikipedia's "Signs of AI writing" catalogue. It catches patterns, not
// quality: passing it means the obvious tells are gone, not that the copy is
// good. Run it before showing copy to the owner for approval.
const AI_WORDS = [
  "delve", "crucial", "pivotal", "seamless", "seamlessly", "unlock", "unlocks", "elevate",
  "empower", "empowers", "testament", "tapestry", "vibrant", "robust", "leverage", "harness",
  "streamline", "streamlines", "supercharge", "effortless", "effortlessly", "cutting-edge",
  "transformative", "holistic", "synergy", "unleash", "game-changer", "game-changing",
  "revolutionize", "revolutionizes", "ever-evolving", "embark", "foster", "fostering",
  "showcase", "showcasing", "underscore", "underscores", "intricate", "realm",
];

const RULES = [
  { id: "em-dash", test: /—/, message: "Em dash. Use a comma, period or parentheses." },
  {
    id: "negative-parallelism",
    test: /\b(it'?s|this is) not (just|only|merely|about)\b|\bnot (just|only|merely) [^.!?]{1,60}\b(but|it'?s)\b|\b(is|are|was) not (the|a|an) [^.!?,]{1,50} but\b/i,
    message: "\"Not X, but Y\" construction. Say the positive point directly.",
  },
  {
    id: "ai-vocabulary",
    test: new RegExp(`\\b(${AI_WORDS.join("|")})\\b`, "i"),
    message: "Inflated AI vocabulary. Use a plain word.",
  },
  {
    id: "tailing-negation",
    test: /, not (from|by|with|a|an|the) [^.!?]{1,40}[.!?]/i,
    message: "Contrast tacked on the end (\", not from a perfect plan.\"). Usually a slogan; cut it or make it a real sentence.",
  },
  {
    id: "copula-avoidance",
    test: /\b(serves as|stands as|boasts|functions as)\b/i,
    message: "Elaborate stand-in for \"is\" or \"has\".",
  },
  {
    id: "filler",
    test: /\b(in order to|it is important to note|due to the fact that|at this point in time|has the ability to)\b/i,
    message: "Filler phrase. Cut it down.",
  },
  {
    id: "signposting",
    test: /\b(let'?s (dive|explore|break)|here'?s (what|how) you|without further ado|in today'?s (fast|busy|world))\b/i,
    message: "Announces instead of saying. Start with the point.",
  },
  {
    id: "authority-trope",
    test: /\b(at its core|the real question is|what really matters|the truth is)\b/i,
    message: "Pretends to cut to a deeper truth. State the point plainly.",
  },
  {
    id: "chatbot-artifact",
    test: /\b(i hope this helps|great question|certainly!|let me know if)\b/i,
    message: "Chatbot phrase left in copy.",
  },
  {
    id: "flattery",
    test: /\b(one of the most (useful|helpful|valuable|insightful)|huge fan|absolutely love|incredible work|amazing work)\b/i,
    message: "Flattery. Editors and readers discount it; be specific or cut it.",
  },
];

// Three or more very short sentences in a row ("Keep the list. Pick three.
// Start one.") read as a slogan generator, not a person.
function sloganRuns(text) {
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const runs = [];
  let run = [];
  for (const sentence of sentences) {
    if (sentence.split(/\s+/).length <= 4 && !/^https?:/.test(sentence)) run.push(sentence);
    else {
      if (run.length >= 3) runs.push(run.join(" "));
      run = [];
    }
  }
  if (run.length >= 3) runs.push(run.join(" "));
  return runs;
}

export function lintCopy(text) {
  const findings = [];
  text.split("\n").forEach((line, index) => {
    for (const rule of RULES) {
      const match = line.match(rule.test);
      if (match) findings.push({ line: index + 1, rule: rule.id, match: match[0], message: rule.message });
    }
    for (const run of sloganRuns(line))
      findings.push({ line: index + 1, rule: "slogan-triplet", match: run, message: "Run of very short sentences reads like a slogan. Combine or rewrite." });
  });
  const exclamations = (text.match(/!/g) ?? []).length;
  if (exclamations > 1)
    findings.push({ line: null, rule: "exclamations", match: `${exclamations}×!`, message: "More than one exclamation mark." });
  return { ok: findings.length === 0, findings };
}
