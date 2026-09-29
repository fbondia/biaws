import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const domain = args.find((value) => !value.startsWith("--"));
const options = args.filter((value) => value.startsWith("--"));
const layer = options
  .find((value) => value.startsWith("--layer="))
  ?.split("=")[1];
const layers = new Set(["unit", "mongo", "http"]);
if (layer && !layers.has(layer))
  throw new Error("Use --layer=unit, mongo ou http");
if (domain && !/^[a-zA-Z]+$/.test(domain)) throw new Error("Domínio inválido");
async function discover(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await discover(filename)));
    else if (/\.test\.js$/.test(entry.name)) files.push(filename);
  }
  return files;
}
const files = (await discover(domain ? `test/${domain}` : "test"))
  .sort()
  .filter((filename) => {
    const actual = /HttpIntegration|resourceReadsIntegration/.test(filename)
      ? "http"
      : /Integration/.test(filename)
        ? "mongo"
        : "unit";
    return !layer || actual === layer;
  });
if (!files.length) throw new Error("Nenhum teste encontrado");
const child = spawn(process.execPath, ["--test", ...files], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
