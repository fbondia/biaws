const EMPTY_DRAFT = {
  skillId: "",
  name: "",
  description: "",
  version: "1.0.0",
  changelog: "",
  files: [],
};

export function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function parseSkillFrontmatter(contents) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(contents);
  if (!match) return {};
  const result = {};
  for (const line of match[1].split(/\r?\n/u)) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error || new Error(`Falha ao ler ${file.name}`));
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.readAsDataURL(file);
  });
}

export function fileSourcePath(file) {
  return file.relativePath || file.webkitRelativePath || file.name;
}

export function relativeFilePath(file) {
  const source = fileSourcePath(file);
  const parts = source.replaceAll("\\", "/").split("/").filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join("/") : parts[0];
}

function readEntryFile(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

function readEntryBatch(reader) {
  return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
}

async function readDirectoryEntries(entry) {
  const reader = entry.createReader();
  const entries = [];
  let batch = await readEntryBatch(reader);
  while (batch.length) {
    entries.push(...batch);
    batch = await readEntryBatch(reader);
  }
  return entries;
}

async function filesFromEntry(entry, parentPath = "") {
  const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
  if (entry.isFile) {
    const file = await readEntryFile(entry);
    Object.defineProperty(file, "relativePath", {
      configurable: true,
      value: path,
    });
    return [file];
  }
  if (!entry.isDirectory) return [];

  const children = await readDirectoryEntries(entry);
  const nestedFiles = await Promise.all(
    children.map((child) => filesFromEntry(child, path)),
  );
  return nestedFiles.flat();
}

export async function filesFromDataTransfer(dataTransfer) {
  const entries = [...(dataTransfer?.items || [])]
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean);
  if (!entries.length) return [...(dataTransfer?.files || [])];

  const files = await Promise.all(
    entries.map((entry) => filesFromEntry(entry)),
  );
  return files.flat();
}

export async function buildFiles(fileList) {
  return Promise.all(
    [...fileList].map(async (file) => ({
      path: relativeFilePath(file),
      contentBase64: await readFileAsBase64(file),
      size: file.size,
    })),
  );
}

export function decodePreview(file) {
  if (!file?.contentBase64) return "";
  const bytes = Uint8Array.from(atob(file.contentBase64), (character) =>
    character.charCodeAt(0),
  );
  if (bytes.some((byte) => byte === 0)) return null;
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
