import crypto from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

const MAX_FILES = 200;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;

function normalizeRelativePath(value) {
  return value.split(path.sep).join("/");
}

async function collectFiles(root, current = root, result = []) {
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    const relativePath = normalizeRelativePath(
      path.relative(root, absolutePath),
    );
    if (entry.isSymbolicLink())
      throw new Error(`Links simbólicos não são permitidos: ${relativePath}`);
    if (entry.isDirectory()) {
      await collectFiles(root, absolutePath, result);
    } else if (entry.isFile()) {
      result.push({ absolutePath, path: relativePath });
    }
  }
  return result;
}

function extractFrontmatter(markdown) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(markdown);
  if (!match) return {};
  const values = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value) values[key] = value;
  }
  return values;
}

export async function buildSkillPayload(directory, options = {}) {
  const root = path.resolve(directory);
  const stats = await lstat(root);
  if (!stats.isDirectory())
    throw new Error(`Diretório de skill inválido: ${root}`);
  const entries = await collectFiles(root);
  if (!entries.some((entry) => entry.path === "SKILL.md")) {
    throw new Error(`SKILL.md não encontrado em ${root}`);
  }
  if (entries.length > MAX_FILES)
    throw new Error(`A skill excede o limite de ${MAX_FILES} arquivos`);

  let totalBytes = 0;
  const files = [];
  for (const entry of entries) {
    const content = await readFile(entry.absolutePath);
    if (content.length > MAX_FILE_BYTES) {
      throw new Error(`Arquivo excede ${MAX_FILE_BYTES} bytes: ${entry.path}`);
    }
    totalBytes += content.length;
    if (totalBytes > MAX_PACKAGE_BYTES) {
      throw new Error(`A skill excede o limite de ${MAX_PACKAGE_BYTES} bytes`);
    }
    files.push({
      path: entry.path,
      contentBase64: content.toString("base64"),
    });
  }
  const skillMarkdown = await readFile(path.join(root, "SKILL.md"), "utf8");
  const frontmatter = extractFrontmatter(skillMarkdown);
  const skillId = String(
    options.id || frontmatter.name || path.basename(root),
  ).trim();
  const description = String(
    options.description || frontmatter.description || "",
  ).trim();
  if (!description) {
    throw new Error(
      "Descrição ausente; informe --description ou adicione description ao SKILL.md",
    );
  }
  return {
    skillId,
    name: String(options.name || skillId),
    description,
    version: String(options.version || ""),
    changelog: String(options.changelog || ""),
    files,
  };
}

export function checksumPackageFiles(files) {
  const hash = crypto.createHash("sha256");
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const content = Buffer.from(file.contentBase64, "base64");
    const fileHash = crypto.createHash("sha256").update(content).digest("hex");
    hash.update(file.path);
    hash.update("\0");
    hash.update(fileHash);
    hash.update("\0");
  }
  return hash.digest("hex");
}
