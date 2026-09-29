import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await rm(new URL("../dist/", import.meta.url), {
  recursive: true,
  force: true,
});
const result = spawnSync(
  process.execPath,
  [new URL("../node_modules/typescript/bin/tsc", import.meta.url).pathname, "-p", "tsconfig.json"],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
