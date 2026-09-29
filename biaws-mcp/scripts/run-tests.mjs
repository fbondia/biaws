import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../dist/test/", import.meta.url));
async function discover(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await discover(file)));
    else if (entry.name.endsWith(".test.js")) files.push(file);
  }
  return files.sort();
}
const filters = process.argv.slice(2);
const listOnly = filters.includes("--list");
if (listOnly) filters.splice(filters.indexOf("--list"), 1);
const files = (await discover(root)).filter(
  (file) =>
    !filters.length ||
    filters.some((filter) => path.relative(root, file).includes(filter)),
);
if (!files.length) throw new Error("No test files matched");
if (listOnly) {
  process.stdout.write(
    files.map((file) => path.relative(root, file)).join("\n") + "\n",
  );
  process.exit(0);
}
const result = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
