import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

await rm("dist", { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  ["node_modules/typescript/bin/tsc", "-p", process.argv.includes("--tests") ? "tsconfig.json" : "tsconfig.build.json"],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir("dist/biaws-api", { recursive: true });
await writeFile("dist/biaws-api/package.json", JSON.stringify({ type: "module" }) + "\n");
await cp("../shared/package.json", "dist/shared/package.json");
if (process.argv.includes("--tests")) {
  await cp("test/fixtures", "dist/biaws-api/test/fixtures", {
    recursive: true,
  });
}
