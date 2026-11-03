import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openStore } from "../store.mjs";

// Each test gets its own throwaway brand folder and database so tests never
// share state (and never touch a real brand under brands/).
export async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "marketing-engine-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const brand = join(root, "brands", "sample");
  await mkdir(join(brand, "work"), { recursive: true });
  await writeFile(join(brand, "work/post.png"), "original image bytes");
  const db = openStore(join(brand, ".state", "engine.sqlite"));
  t.after(() => db.close());
  return { root, brand, db };
}

// A scripted stand-in for a real provider. `behaviour` decides what each
// publish call does, and every call is recorded so tests can prove that the
// engine never sent something twice.
export function fakeAdapter(behaviour, lookup = async () => ({ state: "unknown" })) {
  const calls = [];
  return {
    calls,
    async publish(request) {
      calls.push(request);
      return behaviour(request, calls.length);
    },
    lookup,
  };
}

export const yes = async () => true;
export const no = async () => false;

export const standingGrant = {
  channel: "threads",
  account: "sample",
  maxPerDay: 1,
  timezone: "America/New_York",
  pauseAfterFailures: 2,
  expiresAt: "2027-01-01T00:00:00Z",
  statement: "Publish at most one original post per day to @sample Threads.",
};
