import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { listBrands, readBrand, readRecord } from "./workspace.mjs";

const assets = new Map([
  ["", ["index.html", "text/html; charset=utf-8"]],
  ["app.mjs", ["app.mjs", "text/javascript; charset=utf-8"]],
  ["view.mjs", ["view.mjs", "text/javascript; charset=utf-8"]],
  ["text.mjs", ["text.mjs", "text/javascript; charset=utf-8"]],
  ...[
    "dom.mjs",
    "metric-view.mjs",
    "charts.mjs",
    "chart-model.mjs",
    "records.mjs",
    "markdown-model.mjs",
  ].map((file) => [file, [file, "text/javascript; charset=utf-8"]]),
  ["style.css", ["style.css", "text/css; charset=utf-8"]],
  ["styles/base.css", ["styles/base.css", "text/css; charset=utf-8"]],
  ["styles/overview.css", ["styles/overview.css", "text/css; charset=utf-8"]],
  ["styles/records.css", ["styles/records.css", "text/css; charset=utf-8"]],
  [
    "styles/responsive.css",
    ["styles/responsive.css", "text/css; charset=utf-8"],
  ],
]);

const headers = {
  "Cache-Control": "no-store, private",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export async function startDashboard({ root, port = 4317, demo = false } = {}) {
  const token = randomBytes(24).toString("hex");
  const prefix = `/${token}/`;
  const server = createServer(async (request, response) => {
    const send = (
      status,
      content,
      type = "application/json; charset=utf-8",
    ) => {
      response.writeHead(status, { ...headers, "Content-Type": type });
      response.end(request.method === "HEAD" ? undefined : content);
    };
    const json = (status, value) => send(status, JSON.stringify(value));
    const localOrigin = `http://127.0.0.1:${server.address().port}`;
    try {
      if (
        request.headers.host !== new URL(localOrigin).host ||
        (request.headers.origin && request.headers.origin !== localOrigin) ||
        request.headers["sec-fetch-site"] === "cross-site"
      ) {
        return json(403, {
          error: "This dashboard accepts local same-origin requests only.",
        });
      }
      if (!["GET", "HEAD"].includes(request.method)) {
        response.setHeader("Allow", "GET, HEAD");
        return json(405, {
          error: "Read-only dashboard. Continue in Codex to make changes.",
        });
      }
      const url = new URL(request.url, localOrigin);
      if (!url.pathname.startsWith(prefix))
        return json(404, { error: "Dashboard session not found." });
      const route = url.pathname.slice(prefix.length);
      if (assets.has(route)) {
        const [file, type] = assets.get(route);
        return send(
          200,
          await readFile(new URL(`./public/${file}`, import.meta.url)),
          type,
        );
      }
      if (route === "api/brands")
        return json(200, { brands: await listBrands(root), demo });
      const match = route.match(/^api\/brands\/([^/]+)(\/record)?$/);
      if (!match) return json(404, { error: "Page not found." });
      const id = decodeURIComponent(match[1]);
      if (match[2])
        return json(
          200,
          await readRecord(root, id, url.searchParams.get("path")),
        );
      return json(200, { ...(await readBrand(root, id)), demo });
    } catch (error) {
      const status = error.status || (error.code === "ENOENT" ? 404 : 500);
      return json(status, {
        error: error.status
          ? error.message
          : status === 404
            ? "Record not found."
            : "Unable to read this workspace. Ask Codex to check the local files.",
      });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}${prefix}` };
}
