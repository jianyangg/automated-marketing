import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { startDashboard } from "./http.mjs";

try {
  const { values } = parseArgs({
    options: {
      demo: { type: "boolean", default: false },
      port: { type: "string", default: "4317" },
    },
  });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw Error("Use a valid local port (0–65535).");
  const repository = fileURLToPath(new URL("../../", import.meta.url));
  const root = values.demo ? resolve(repository, "examples") : repository;
  const { server, url } = await startDashboard({
    root,
    port,
    demo: values.demo,
  });
  console.log(
    `Marketing dashboard${values.demo ? " · fictional example" : ""}\n${url}\nRead-only · localhost only · keep this terminal running. Ctrl+C to stop.`,
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.once(signal, () => {
      server.close();
      server.closeAllConnections();
    });
} catch (error) {
  console.error(
    error.code === "EADDRINUSE"
      ? "Port is busy. Try npm run dashboard -- --port 0."
      : error.message,
  );
  process.exitCode = 1;
}
