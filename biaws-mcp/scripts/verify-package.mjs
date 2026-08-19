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
const lock = JSON.parse(
  await readFile(path.join(packageDirectory, "package-lock.json"), "utf8"),
);
const versionSource = await readFile(
  path.join(packageDirectory, "src/version.js"),
  "utf8",
);

assert.equal(metadata.name, "biaws-mcp", "nome público inesperado");
assert.equal(
  metadata.bin?.["biaws-mcp"],
  "bin/biaws-mcp.js",
  "binário inesperado",
);
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
  versionSource.match(/SERVER_NAME = "([^"]+)"/u)?.[1],
  metadata.name,
  "nome anunciado pelo servidor fora de sincronia",
);
assert.equal(
  versionSource.match(/SERVER_VERSION = "([^"]+)"/u)?.[1],
  metadata.version,
  "versão anunciada pelo servidor fora de sincronia",
);
assert.equal(
  lock.packages?.[""]?.name,
  metadata.name,
  "raiz do lock divergente",
);
assert.equal(
  lock.packages?.[""]?.bin?.["biaws-mcp"],
  metadata.bin["biaws-mcp"],
  "binário do lock divergente",
);

const entrypoint = path.join(packageDirectory, metadata.bin["biaws-mcp"]);
const contents = await readFile(entrypoint, "utf8");
assert.equal(contents.split(/\r?\n/u, 1)[0], "#!/usr/bin/env node");
if (process.platform !== "win32") {
  assert.notEqual(
    (await stat(entrypoint)).mode & 0o111,
    0,
    "binário sem permissão de execução",
  );
}

for (const required of [
  "LICENSE",
  "README.md",
  "docs/releasing.md",
  "src/index.js",
  "src/loadEnv.js",
]) {
  await access(path.join(packageDirectory, required));
}

try {
  assert.equal(
    await readFile(path.join(packageDirectory, "LICENSE"), "utf8"),
    await readFile(path.resolve(packageDirectory, "../LICENSE"), "utf8"),
    "a licença empacotada divergiu da fonte canônica",
  );
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

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

for (const directory of ["bin", "src"]) {
  for (const file of await sourceFiles(
    path.join(packageDirectory, directory),
  )) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(
      /(?:from\s+|import\s*)["'](\.\.?\/[^"']+)["']/gu,
    )) {
      const target = path.resolve(path.dirname(file), match[1]);
      assert.ok(
        target === packageDirectory ||
          target.startsWith(`${packageDirectory}${path.sep}`),
        `${path.relative(packageDirectory, file)} importa arquivo externo: ${match[1]}`,
      );
    }
  }
}

for (const forbidden of ["test", "scripts", ".scannerwork", "node_modules"]) {
  assert.equal(
    metadata.files.includes(forbidden),
    false,
    `${forbidden} não deve ser publicado`,
  );
}

process.stdout.write(`Pacote ${metadata.name}@${metadata.version} validado.\n`);
