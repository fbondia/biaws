import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, readdir, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { buildPlugin } from "../../plugins/scripts/build.mjs";
import { verifyInstall } from "../../plugins/scripts/verify-install.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2),
  options = {};
for (let i = 0; i < args.length; i++) {
  const key = args[i];
  if (key === "--allow-loopback") options.allowLoopback = true;
  else if (["--url", "--integration-report"].includes(key) && args[i + 1] && !args[i + 1].startsWith("--"))
    options[key] = args[++i];
  else
    throw new Error("Usage: consolidate-candidate.mjs --url ENDPOINT [--allow-loopback] [--integration-report JSON]");
}
assert.ok(options["--url"], "Informe o endpoint explícito do candidato");
const json = async (relative) => JSON.parse(await readFile(path.join(root, relative), "utf8"));
const output = path.join(root, "plugins/dist/chatgpt-plugin");
await mkdir(output, { recursive: true });
const run = (command, commandArgs, cwd = root) =>
  execFileSync(command, commandArgs, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_cache: process.env.npm_config_cache || path.join(os.tmpdir(), "biaws-chatgpt-npm-cache"),
    },
  });
const release = await json("release.json"),
  compatibility = await json("plugins/compatibility.json");
assert.equal(release.schemaVersion, compatibility.releaseSchema);
assert.ok(release.deploymentRevision >= compatibility.minimumDeploymentRevision);
run(process.execPath, ["scripts/release-manifest.mjs", "check"]);
run("npm", ["run", "build"], path.join(root, "biaws-mcp"));
const { catalogReadiness } = await import("../../plugins/scripts/catalog-readiness.mjs");
const artifacts = [];
for (const component of ["biaws-mcp", "biaws-cli"]) {
  run(process.execPath, ["scripts/verify-package.mjs"], path.join(root, component));
  const packed = JSON.parse(
    run("npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", output], path.join(root, component)),
  )[0];
  artifacts.push({
    path: packed.filename,
    sha256: createHash("sha256")
      .update(await readFile(path.join(output, packed.filename)))
      .digest("hex"),
  });
}
const plugin = await buildPlugin({
  url: options["--url"],
  outputDirectory: path.join(output, "plugin-candidate"),
  allowLoopback: options.allowLoopback,
});
const archive = path.join(output, "plugin-candidate", plugin.name);
const installed = await verifyInstall(archive, plugin.sha256, { allowLoopback: options.allowLoopback });
artifacts.push({ path: "plugin-candidate/" + plugin.name, sha256: plugin.sha256 });
const writeJson = (name, value) => writeFile(path.join(output, name), JSON.stringify(value, null, 2) + "\n");
await writeJson("plugin-candidate/install-report.json", installed);
const readiness = catalogReadiness(
  await json("plugins/biaws/plugin.json"),
  await json("plugins/catalog/readiness.json"),
  installed,
);
await writeJson("catalog-readiness.json", readiness);
if (options["--integration-report"]) {
  const report = JSON.parse(await readFile(options["--integration-report"], "utf8"));
  assert.equal(report.result, "passed");
  await copyFile(options["--integration-report"], path.join(output, "integration-report.json"));
}
await writeJson("release-evidence.json", {
  improvement: "CHATGPT-PLUGIN",
  status: "local-candidate-external-gates-pending",
  sourceCommit: run("git", ["rev-parse", "HEAD"]).trim(),
  release,
  compatibility,
  artifacts,
  npmPublication: "pending",
  realChatgptValidation: "pending",
  catalogSubmission: "not-performed",
});
await writeFile(
  path.join(output, "README.md"),
  `# Candidato local CHATGPT-PLUGIN

Pacotes e evidências gerados do checkout; nenhuma publicação é executada.
O ZIP usa o endpoint ${options["--url"]} e continua candidato por instância.
Loopback serve somente para testes offline. Este diretório não comprova acesso
pelo ChatGPT, publicação npm ou aprovação do catálogo.

- [Checksums de todos os arquivos](SHA256SUMS)
- [Versões e origem](release-evidence.json)
- [Prontidão externa](catalog-readiness.json)
- [Instalação offline](plugin-candidate/install-report.json)

Relatório de revisão no checkout: docs/chatgpt-review.md.
Passos externos no checkout: docs/chatgpt-external-actions.md.
`,
);
async function checksums(directory, prefix = "") {
  const rows = [];
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const relative = prefix + entry.name,
      full = path.join(directory, entry.name);
    if (entry.isDirectory()) rows.push(...(await checksums(full, relative + "/")));
    else if (relative !== "SHA256SUMS")
      rows.push(
        createHash("sha256")
          .update(await readFile(full))
          .digest("hex") +
          "  " +
          relative +
          "\n",
      );
  }
  return rows;
}
await writeFile(path.join(output, "SHA256SUMS"), (await checksums(output)).join(""));
console.log(JSON.stringify({ output, artifacts, submissionReady: readiness.submissionReady }, null, 2));
