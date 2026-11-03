import { execFileSync } from "node:child_process";
import { EngineError } from "./store.mjs";

// Credentials live in the macOS login Keychain, never in brand files, the
// database, logs or command history. Each secret is a JSON object stored as a
// generic password under one service name, keyed by "<brand>/<purpose>".
const SERVICE = "automated-marketing";

export function setupCommand(key) {
  // With -w as the final argument, `security` prompts for the value, so the
  // token is typed (or pasted) at the prompt rather than left in shell history.
  return `security add-generic-password -U -s ${SERVICE} -a ${key} -w`;
}

export function readSecret(key, { run = execFileSync } = {}) {
  let raw;
  try {
    raw = run("security", ["find-generic-password", "-s", SERVICE, "-a", key, "-w"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new EngineError(
      "missing_secret",
      `No Keychain item for ${key}. The owner can add it with: ${setupCommand(key)}`,
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new EngineError("invalid_secret", `Keychain item ${key} must contain a JSON object.`);
  }
}

// Used only to store a refreshed token the provider just issued. The value is
// briefly visible in the local process list while `security` runs, which is
// acceptable on a single-user Mac but is the reason this is the only writer.
// A failed write must not surface the original error: Node's message for a
// failed child process includes its full argument list, token included.
export function writeSecret(key, value, { run = execFileSync } = {}) {
  try {
    run(
      "security",
      ["add-generic-password", "-U", "-s", SERVICE, "-a", key, "-w", JSON.stringify(value)],
      { stdio: "ignore" },
    );
  } catch {
    throw new EngineError(
      "keychain_write_failed",
      `Could not save the refreshed credential to Keychain item ${key} (is the login Keychain locked?). The previous token is unchanged; unlock the Keychain and run refresh-token again.`,
    );
  }
}
