import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const apiRequire = createRequire(
  new URL("../biaws-api/package.json", import.meta.url),
);
const tsx = apiRequire.resolve("tsx");
const build = spawnSync(process.execPath, ["scripts/build.mjs"], {
  cwd: fileURLToPath(new URL("../biaws-mcp/", import.meta.url)),
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const result = spawnSync(
  process.execPath,
  [
    "--import",
    tsx,
    "--test",
    "test/integration/resourceRoutesInventory.test.mjs",
  ],
  { cwd: root, stdio: "inherit" },
);
process.exit(result.status ?? 1);
