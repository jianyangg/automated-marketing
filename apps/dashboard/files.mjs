import { open, realpath, lstat } from "node:fs/promises";
import { join, relative, extname, isAbsolute } from "node:path";

export function problem(status, message) {
  return Object.assign(new Error(message), { status });
}

function inside(parent, child) {
  const path = relative(parent, child);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

export function validBrandId(id) {
  return typeof id === "string" && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(id);
}

export async function brandsDirectory(root) {
  const workspace = await realpath(root);
  const base = await realpath(join(workspace, "brands"));
  if (!inside(workspace, base)) throw problem(403, "Workspace is unavailable.");
  return base;
}

export async function brandDirectory(root, id) {
  if (!validBrandId(id)) throw problem(403, "Invalid business selection.");
  const base = await brandsDirectory(root);
  const path = join(base, id);
  if (!(await lstat(path)).isDirectory())
    throw problem(403, "Business folder is unavailable.");
  const directory = await realpath(path);
  if (!inside(base, directory))
    throw problem(403, "Business folder is unavailable.");
  return directory;
}

export function readableRecord(path) {
  if (
    typeof path !== "string" ||
    path.length > 600 ||
    path.includes("\\") ||
    path.includes("\0")
  )
    return false;
  if (path.split("/").some((part) => !part || part.startsWith(".")))
    return false;
  if (![".md", ".json", ".txt", ".csv"].includes(extname(path).toLowerCase()))
    return false;
  return (
    ["index.md", "brand.md"].includes(path) ||
    /^(research|strategy|reports|work|assets)\//.test(path)
  );
}

export async function readBrandFile(directory, path, limit = 2_000_000) {
  if (!readableRecord(path) && path !== "dashboard.json")
    throw problem(403, "This record is outside the readable workspace.");
  const resolved = await realpath(join(directory, path));
  if (!inside(directory, resolved))
    throw problem(403, "This record is outside the readable workspace.");
  const file = await open(resolved, "r");
  try {
    const stat = await file.stat();
    if (!stat.isFile()) throw problem(403, "This record is unavailable.");
    if (stat.size > limit)
      throw problem(413, "This record is too large to preview.");
    return {
      content: await file.readFile("utf8"),
      modifiedAt: stat.mtime.toISOString(),
    };
  } finally {
    await file.close();
  }
}
