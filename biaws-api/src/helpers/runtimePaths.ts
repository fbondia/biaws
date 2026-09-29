import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function apiRoot(): string {
  let directory = path.dirname(fileURLToPath(import.meta.url));
  while (true) {
    const manifest = path.join(directory, "package.json");
    if (existsSync(manifest)) {
      const value: unknown = JSON.parse(readFileSync(manifest, "utf8"));
      if (value && typeof value === "object" && "name" in value && value.name === "@bondia/biaws-api") return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error("API package root not found");
    directory = parent;
  }
}
export const API_ROOT = apiRoot();
export const WORKSPACE_ROOT = path.resolve(API_ROOT, "..");
