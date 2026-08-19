import assert from "node:assert/strict";
import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const metadata = JSON.parse(
  await readFile(path.join(packageDirectory, "package.json"), "utf8"),
);
const agentSource = await readFile(
  path.join(packageDirectory, "src/commands/agent.js"),
  "utf8",
);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(entryPath)));
    else if ([".js", ".mjs"].includes(path.extname(entry.name)))
      files.push(entryPath);
  }
  return files;
}
const lock = JSON.parse(
  await readFile(path.join(packageDirectory, "package-lock.json"), "utf8"),
);

assert.equal(metadata.name, "biaws", "o pacote deve ser publicado como biaws");
assert.equal(metadata.oclif?.bin, "biaws", "oclif.bin deve ser biaws");
assert.equal(metadata.bin?.biaws, "bin/biaws.js", "binário npm inesperado");
assert.equal(
  metadata.publishConfig?.access,
  "public",
  "acesso deve ser público",
);
assert.equal(lock.name, metadata.name, "package-lock fora de sincronia");
assert.equal(
  lock.version,
  metadata.version,
  "versão do lock fora de sincronia",
);
assert.equal(
  lock.packages?.[""]?.name,
  metadata.name,
  "raiz do lock divergente",
);
assert.equal(
  lock.packages?.[""]?.bin?.biaws,
  metadata.bin.biaws,
  "binário do lock divergente",
);

const entrypoint = path.join(packageDirectory, metadata.bin.biaws);
const contents = await readFile(entrypoint, "utf8");
assert.equal(
  contents.split(/\r?\n/u, 1)[0],
  "#!/usr/bin/env node",
  "o binário deve começar com shebang portátil",
);
if (process.platform !== "win32") {
  const entrypointStat = await stat(entrypoint);
  assert.notEqual(
    entrypointStat.mode & 0o111,
    0,
    "o binário deve ter permissão de execução",
  );
}

for (const required of [
  "README.md",
  "LICENSE",
  "docs/command-taxonomy.md",
  "shared/skillPackage.js",
]) {
  await access(path.join(packageDirectory, required));
}

for (const file of await sourceFiles(path.join(packageDirectory, "src"))) {
  const source = await readFile(file, "utf8");
  const imports = source.matchAll(
    /(?:from\s+|import\s*)["'](\.\.?\/[^"']+)["']/gu,
  );
  for (const [, specifier] of imports) {
    const target = path.resolve(path.dirname(file), specifier);
    assert.ok(
      target === packageDirectory ||
        target.startsWith(`${packageDirectory}${path.sep}`),
      `${path.relative(packageDirectory, file)} importa arquivo externo: ${specifier}`,
    );
  }
}

try {
  const canonicalLicense = await readFile(
    path.resolve(packageDirectory, "../LICENSE"),
    "utf8",
  );
  const packagedLicense = await readFile(
    path.join(packageDirectory, "LICENSE"),
    "utf8",
  );
  assert.equal(
    packagedLicense,
    canonicalLicense,
    "a licença empacotada divergiu da fonte canônica",
  );

  const canonicalSkillPackage = await readFile(
    path.resolve(packageDirectory, "../shared/skillPackage.js"),
    "utf8",
  );
  const packagedSkillPackage = await readFile(
    path.join(packageDirectory, "shared/skillPackage.js"),
    "utf8",
  );
  assert.equal(
    packagedSkillPackage,
    canonicalSkillPackage,
    "a cópia empacotada de shared/skillPackage.js divergiu da fonte canônica",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

for (const forbidden of ["test", ".scannerwork", "node_modules"]) {
  assert.equal(
    metadata.files.includes(forbidden),
    false,
    `${forbidden} não deve integrar o pacote publicado`,
  );
}

const mcpName = agentSource.match(
  /export const MCP_PACKAGE_NAME = "([^"]+)";/u,
)?.[1];
const mcpVersion = agentSource.match(
  /export const MCP_PACKAGE_VERSION = "([^"]+)";/u,
)?.[1];
assert.equal(mcpName, "biaws-mcp", "nome do MCP configurado pelo CLI divergiu");
assert.match(mcpVersion || "", /^\d+\.\d+\.\d+$/u, "versão do MCP inválida");

try {
  const mcpMetadata = JSON.parse(
    await readFile(
      path.resolve(packageDirectory, "../biaws-mcp/package.json"),
      "utf8",
    ),
  );
  assert.equal(mcpName, mcpMetadata.name, "nome do MCP fora de sincronia");
  assert.equal(
    mcpVersion,
    mcpMetadata.version,
    "versão do MCP fora de sincronia",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

process.stdout.write(`Pacote ${metadata.name}@${metadata.version} validado.\n`);
