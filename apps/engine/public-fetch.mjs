import { request } from "node:https";
import { lookup as dnsLookup } from "node:dns";
import { BlockList, isIP } from "node:net";
import { EngineError } from "./store.mjs";

// Fetching pages whose addresses came from the open web (competitor URLs an
// agent found while researching) is a server-side request forgery risk: a
// URL, or a redirect it answers with, could point at this machine
// (127.0.0.1), the home router (192.168.x.x) or a cloud metadata service
// (169.254.169.254). Whatever came back would then be saved into the brand
// folder. This module only ever talks to public https hosts.
//
// Why the check lives inside the socket's DNS lookup instead of a separate
// "resolve, check, then fetch" step: a hostile DNS server can answer the
// check with a public address and the real connection a moment later with a
// private one (DNS rebinding). Checking the very address the socket is about
// to connect to closes that gap.

// Ranges that are not the public internet. Sources: IANA IPv4/IPv6
// special-purpose address registries. IPv4 and IPv6 live in separate lists
// on purpose: a single BlockList also matches IPv4 addresses against
// IPv4-mapped IPv6 rules, so "::ffff:0:0/96" would block every IPv4 address.
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, includes cloud metadata services
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 3], // multicast, reserved and broadcast (224/4 + 240/4)
])
  blockedV4.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  ["::ffff:0:0", 96], // IPv4-mapped: a public site never needs this form
  ["64:ff9b::", 96], // NAT64, can wrap a private IPv4 address
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local (private)
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
])
  blockedV6.addSubnet(network, prefix, "ipv6");

// True only for an address on the public internet.
export function isPublicAddress(address) {
  const family = isIP(address);
  if (family === 0) return false;
  return family === 4 ? !blockedV4.check(address, "ipv4") : !blockedV6.check(address, "ipv6");
}

const refused = (url, why) => new EngineError("unsafe_url", `Refused ${url}: ${why}`);

// Throws unless the URL is https and, when its host is a literal IP address,
// that address is public. Hostnames are checked at connect time (see above).
export function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw refused(raw, "not a valid URL.");
  }
  if (url.protocol !== "https:") throw refused(raw, "only https pages are fetched.");
  if (url.username || url.password) throw refused(raw, "URLs with credentials are not fetched.");
  // URL keeps IPv6 literals in brackets; strip them for the address check.
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) throw refused(raw, `${host} is not a public address.`);
  return url;
}

// A dns.lookup replacement for the socket: resolves as usual, then refuses
// the connection if any answer is not a public address.
function publicLookup(hostname, options, callback) {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    const bad = addresses.find((entry) => !isPublicAddress(entry.address));
    if (bad) return callback(refused(hostname, `it resolves to ${bad.address}, which is not a public address.`));
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

const MAX_BYTES = 5 * 1024 * 1024; // a marketing page; anything larger is not one
// Two clocks. IDLE_MS catches a server that goes silent. It resets on every
// byte, so on its own a server dripping one byte every few seconds could hold
// the run open forever; DEADLINE_MS is the hard cap on the whole page,
// redirects included, which no amount of dripping extends.
const IDLE_MS = 15_000;
const DEADLINE_MS = 45_000;

// One GET with no redirect following, returning a small fetch-like response
// ({ ok, status, headers.get, text }) so callers and test stubs share a shape.
// `signal` aborts the request and its body read when the caller's deadline passes.
export function publicGet(raw, { headers = {}, signal } = {}) {
  const url = assertPublicUrl(raw);
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      // identity: Node's https module does not decompress, so ask for plain bytes.
      { method: "GET", headers: { ...headers, "accept-encoding": "identity" }, lookup: publicLookup, timeout: IDLE_MS, signal },
      (res) => {
        const chunks = [];
        let size = 0;
        let ended = false;
        res.on("data", (chunk) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy(new Error(`Page is larger than ${MAX_BYTES} bytes.`));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          ended = true;
          const body = Buffer.concat(chunks).toString("utf8");
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            headers: { get: (name) => res.headers[name.toLowerCase()] ?? null },
            text: async () => body,
          });
        });
        res.on("error", reject);
        // A body cut off without an error event must still settle the promise,
        // or the run would wait forever. Settling twice is a no-op.
        res.on("close", () => {
          if (!ended) reject(new Error("The connection closed before the page finished."));
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error(`No data for ${IDLE_MS / 1000}s.`)));
    req.on("error", reject);
    req.end();
  });
}

const MAX_REDIRECTS = 5;

// Follows redirects by hand so every hop passes the same checks as the first
// URL: still https, still a public host. One deadline covers every hop.
// `get` and `deadlineMs` are injectable for tests.
export async function fetchPublicPage(raw, { headers, get = publicGet, deadlineMs = DEADLINE_MS } = {}) {
  const signal = AbortSignal.timeout(deadlineMs);
  let current = raw;
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertPublicUrl(current);
      const response = await get(current, { headers, signal });
      const location = response.status >= 300 && response.status < 400 ? response.headers?.get("location") : null;
      if (!location) return response;
      current = new URL(location, current).href;
    }
  } catch (error) {
    if (signal.aborted) throw new EngineError("timeout", `${raw} did not finish within ${deadlineMs / 1000}s.`);
    throw error;
  }
  throw new EngineError("unsafe_url", `Gave up on ${raw} after ${MAX_REDIRECTS} redirects.`);
}
