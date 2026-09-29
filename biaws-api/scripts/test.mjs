import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const domain = args.find((value) => !value.startsWith("--"));
const options = args.filter((value) => value.startsWith("--"));
const layer = options.find((value) => value.startsWith("--layer="))?.split("=")[1];
const layers = new Set(["unit", "mongo", "http"]);
if (layer && !layers.has(layer)) throw new Error("Use --layer=unit, mongo ou http");
if (domain && !/^[a-zA-Z]+$/.test(domain)) throw new Error("Domínio inválido");
async function discover(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await discover(filename)));
    else if (/\.test\.(js|ts)$/.test(entry.name)) files.push(filename);
  }
  return files;
}
const compiled = options.includes("--compiled");
const coverage = options.includes("--coverage");
if (coverage) {
  await mkdir("coverage", { recursive: true });
  await rm("coverage/lcov.info", { force: true });
}
const testRoot = compiled ? "dist/biaws-api/test" : "test";
const files = (await discover(domain ? `${testRoot}/${domain}` : testRoot)).sort().filter((filename) => {
  const actual = /HttpIntegration|resourceReadsIntegration/.test(filename)
    ? "http"
    : /Integration/.test(filename)
      ? "mongo"
      : "unit";
  return !layer || actual === layer;
});
if (!files.length) throw new Error("Nenhum teste encontrado");
const child = spawn(
  process.execPath,
  [
    ...(compiled ? [] : ["--import", "tsx"]),
    ...(coverage
      ? [
          "--experimental-test-coverage",
          "--test-reporter=dot",
          "--test-reporter=lcov",
          "--test-reporter-destination=stdout",
          "--test-reporter-destination=coverage/lcov.info",
        ]
      : []),
    "--test",
    ...files,
  ],
  {
    stdio: "inherit",
    env: process.env,
  },
);
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
