import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([".git", "node_modules"]);

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredDirectories.has(entry.name)) return [];
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(entryPath);
    return entryPath.endsWith(".md") ? [entryPath] : [];
  });
}

const failures = [];
const obsoleteCommand = /^\s*biaws\s+(agent|instance|monitoring|skills)\b/u;
const duplicatedApiPath =
  /(?:BIAWS_API_URL=|config init --api-url )https?:\/\/\S+\/api(?:\s|$)/u;
const markdownLink = /\[[^\]]*\]\(([^)]+)\)/gu;

for (const file of markdownFiles(root)) {
  const contents = readFileSync(file, "utf8");
  const relative = path.relative(root, file);

  for (const [index, line] of contents.split(/\r?\n/u).entries()) {
    if (obsoleteCommand.test(line)) {
      failures.push(
        `${relative}:${index + 1}: taxonomia antiga do CLI; use biaws admin/config/workspace`,
      );
    }
    if (duplicatedApiPath.test(line)) {
      failures.push(
        `${relative}:${index + 1}: a URL base não deve terminar em /api`,
      );
    }
  }

  for (const match of contents.matchAll(markdownLink)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.endsWith(">")) {
      target = target.slice(1, -1);
    }
    if (/^(?:https?:|mailto:|#)/u.test(target)) continue;
    target = target.split("#", 1)[0];
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), decodeURI(target));
    if (!existsSync(resolved)) {
      const line = contents.slice(0, match.index).split(/\r?\n/u).length;
      failures.push(`${relative}:${line}: link local inexistente: ${match[1]}`);
    }
  }
}

const mcpManifest = JSON.parse(
  readFileSync(path.join(root, "biaws-mcp", "package.json"), "utf8"),
);
for (const relative of ["README.md", "QUICKSTART.md", "biaws-mcp/README.md"]) {
  const contents = readFileSync(path.join(root, relative), "utf8");
  for (const match of contents.matchAll(/biaws-mcp@(\d+\.\d+\.\d+)/gu)) {
    assert.equal(
      match[1],
      mcpManifest.version,
      `${relative}: versão fixa do MCP fora de sincronia`,
    );
  }
}

if (failures.length) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("Documentação validada.\n");
}
