import { DefiniteFailure } from "../delivery.mjs";
import { sha256 } from "../actions.mjs";

// Official Threads API (Meta). Publishing has two steps: create a media
// container, wait until Meta has processed it, then publish it. Nothing is
// public until the publish call succeeds, so any failure before that point is
// a definite, safe-to-retry failure. Required scopes: threads_basic,
// threads_content_publish and, for insights, threads_manage_insights.
// https://developers.facebook.com/docs/threads/posts
// Meta documents graph.threads.com and graph.threads.net as equivalent hosts.
export const THREADS_API = "https://graph.threads.com/v1.0";
const MAX_TEXT = 500;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Threads links look like https://www.threads.com/@handle/post/<code> (or
// threads.net). The code identifies the post whatever the host or handle form.
export function shortcodeOf(url) {
  return /\/post\/([A-Za-z0-9_-]+)/.exec(url ?? "")?.[1] ?? null;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function threadsAdapter({
  credentials,
  fetch = globalThis.fetch,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
  baseUrl = THREADS_API,
  pollEveryMs = 10_000,
  maxPolls = 30,
  now = () => new Date(),
}) {
  // Credentials load on first use, so a missing Keychain item only matters
  // when a command actually needs Threads.
  let loaded;
  const auth = () => (loaded ??= credentials());

  async function call(path, { method = "GET", params = {} } = {}) {
    const { accessToken } = auth();
    const query = new URLSearchParams({ ...params, access_token: accessToken });
    const url = method === "GET" ? `${baseUrl}/${path}?${query}` : `${baseUrl}/${path}`;
    const response = await fetch(url, {
      method,
      ...(method !== "GET" && { body: query }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await response.json().catch(() => null);
    // The token is never echoed into errors: only the provider's message.
    if (!response.ok)
      throw new HttpError(response.status, data?.error?.message ?? `Threads HTTP ${response.status}`);
    return data;
  }

  // Threads downloads the image from its public URL. Download it ourselves
  // first and compare hashes, so what Meta fetches is exactly what was approved.
  async function verifyPublicCopy(asset) {
    const response = await fetch(asset.publicUrl, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok)
      throw new DefiniteFailure(`Public image URL returned HTTP ${response.status}.`);
    const type = response.headers.get("content-type") ?? "";
    if (!/^image\/(png|jpeg)\b/.test(type))
      throw new DefiniteFailure(`Threads accepts PNG or JPEG images, not "${type}".`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new DefiniteFailure("Threads images must be 8 MB or smaller.");
    if (sha256(bytes) !== asset.sha256)
      throw new DefiniteFailure(`The image at ${asset.publicUrl} differs from approved ${asset.path}.`);
  }

  async function waitUntilReady(containerId) {
    for (let poll = 0; poll < maxPolls; poll++) {
      const { status, error_message: reason } = await call(containerId, {
        params: { fields: "status,error_message" },
      });
      if (status === "FINISHED") return;
      if (status === "ERROR" || status === "EXPIRED")
        throw new DefiniteFailure(`Threads could not process the post (${status}${reason ? `: ${reason}` : ""}).`);
      if (status === "PUBLISHED")
        throw Object.assign(new Error(`Container ${containerId} is already published; reconcile before anything else.`), {
          maybeLive: true,
        });
      await sleep(pollEveryMs);
    }
    throw new DefiniteFailure("Threads was still processing the post after the polling limit; nothing was published.");
  }

  return {
    async publish({ text, assets }) {
      if ([...text].length > MAX_TEXT)
        throw new DefiniteFailure(`Threads posts are limited to ${MAX_TEXT} characters.`);
      if (assets.length > 1)
        throw new DefiniteFailure("Carousels are not supported yet; propose one image or none.");
      const [image] = assets;
      if (image && !image.publicUrl)
        throw new DefiniteFailure(
          "Threads fetches images from a public URL. Propose the asset as path=https://… after hosting the exact file.",
        );

      let containerId;
      let userId;
      try {
        ({ userId } = auth());
        if (image) await verifyPublicCopy(image);
        ({ id: containerId } = await call(`${userId}/threads`, {
          method: "POST",
          params: image ? { media_type: "IMAGE", image_url: image.publicUrl, text } : { media_type: "TEXT", text },
        }));
        await waitUntilReady(containerId);
      } catch (error) {
        // Before threads_publish nothing is public, whatever went wrong
        // (missing credentials, network, validation). The one exception is a
        // container Meta reports as already published.
        if (error instanceof DefiniteFailure || error.maybeLive) throw error;
        throw new DefiniteFailure(`Not published: ${error.message}`);
      }

      let mediaId;
      try {
        ({ id: mediaId } = await call(`${userId}/threads_publish`, {
          method: "POST",
          params: { creation_id: containerId },
        }));
      } catch (error) {
        // A 4xx answer is the provider refusing the request. A timeout, a
        // dropped connection or a 5xx may have happened after the post went
        // live, so it is left unknown for reconcile.
        if (error instanceof HttpError && error.status >= 400 && error.status < 500)
          throw new DefiniteFailure(`Threads rejected publishing: ${error.message}`);
        throw error;
      }
      // The permalink is a convenience. The post is live either way, so a
      // failed read here must not turn a delivered post into an unknown one.
      let url = null;
      try {
        url = (await call(mediaId, { params: { fields: "permalink" } })).permalink ?? null;
      } catch {}
      return { state: "delivered", providerId: mediaId, url };
    },

    // Finds a send with no receipt by matching the exact text among the
    // account's recent posts. It answers "absent" only after the post has had
    // time to appear and the listing reaches back past the attempt, so a slow
    // feed is never misread as a failed send.
    async lookup({ text, attemptedAt }) {
      const { userId } = auth();
      const attempted = Date.parse(attemptedAt);
      const { data = [] } = await call(`${userId}/threads`, {
        params: { fields: "id,text,permalink,timestamp", limit: "50" },
      });
      const match = data.find(
        (post) => post.text === text && Date.parse(post.timestamp) >= attempted - 5 * 60_000,
      );
      if (match) return { state: "delivered", providerId: match.id, url: match.permalink ?? null };
      const coversAttempt =
        data.length < 50 || data.some((post) => Date.parse(post.timestamp) < attempted);
      const settled = now().getTime() - attempted > 15 * 60_000;
      return { state: coversAttempt && settled ? "absent" : "unknown" };
    },

    // The provider's own record of a post: exact publish time, link and text.
    async media(mediaId) {
      const post = await call(mediaId, { params: { fields: "id,text,permalink,timestamp" } });
      const time = Date.parse(post.timestamp);
      if (!Number.isFinite(time)) throw new Error(`Threads returned no timestamp for ${mediaId}.`);
      return {
        providerId: post.id,
        text: post.text ?? null,
        url: post.permalink ?? null,
        publishedAt: new Date(time).toISOString(),
      };
    },

    // Finds one of the account's own posts by its public link, for posts
    // published outside the engine whose IDs were never recorded. Pages back
    // through the feed (50 per page) up to `maxPages`; null if not found.
    async findByPermalink(url, { maxPages = 10 } = {}) {
      const { userId } = auth();
      const target = shortcodeOf(url);
      if (!target) return null;
      let params = { fields: "id,text,permalink,timestamp", limit: "50" };
      for (let page = 0; page < maxPages; page++) {
        const { data = [], paging } = await call(`${userId}/threads`, { params });
        const match = data.find((post) => post.permalink && shortcodeOf(post.permalink) === target);
        if (match) return this.media(match.id);
        const after = paging?.cursors?.after;
        if (!after || !paging?.next) return null;
        params = { ...params, after };
      }
      return null;
    },

    // Lifetime counts for one post. A metric Meta does not return is left out,
    // never filled in as zero.
    async postInsights(mediaId) {
      const { data = [] } = await call(`${mediaId}/insights`, {
        params: { metric: "views,likes,replies,reposts,quotes,shares" },
      });
      return Object.fromEntries(
        data
          .filter((entry) => Number.isFinite(entry.values?.[0]?.value))
          .map((entry) => [entry.name, entry.values[0].value]),
      );
    },

    async followers() {
      const { userId } = auth();
      const { data = [] } = await call(`${userId}/threads_insights`, {
        params: { metric: "followers_count" },
      });
      const value = data.find((entry) => entry.name === "followers_count")?.total_value?.value;
      return Number.isFinite(value) ? value : null;
    },

    // Long-lived tokens last about 60 days; refreshing returns a new one.
    // https://developers.facebook.com/docs/threads/get-started/long-lived-tokens
    async refreshToken() {
      const { accessToken } = auth();
      const query = new URLSearchParams({ grant_type: "th_refresh_token", access_token: accessToken });
      const response = await fetch(`${baseUrl.replace(/\/v[\d.]+$/, "")}/refresh_access_token?${query}`, {
        signal: AbortSignal.timeout(30_000),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.access_token)
        throw new HttpError(response.status, data?.error?.message ?? "Token refresh failed.");
      return { accessToken: data.access_token, expiresInSeconds: data.expires_in ?? null };
    },
  };
}
