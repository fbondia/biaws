import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { getIssueBaseDir } from "../helpers/issueStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ISSUES_ROOT = path.resolve(__dirname, "../../..");

function readOption(options, key) {
  return (
    options?.[key] ??
    options?.[key.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())]
  );
}

function resolveRootDir(options) {
  const configuredDir = String(
    readOption(options, "attachment-storage-local-dir") ||
      process.env.ATTACHMENT_STORAGE_LOCAL_DIR ||
      "",
  ).trim();

  if (!configuredDir) return getIssueBaseDir(options);
  return path.isAbsolute(configuredDir)
    ? configuredDir
    : path.resolve(ISSUES_ROOT, configuredDir);
}

function resolveKey(rootDir, key) {
  const normalizedKey = String(key || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/u, "");
  const resolvedPath = path.resolve(rootDir, normalizedKey);
  const relativePath = path.relative(rootDir, resolvedPath);

  if (
    !normalizedKey ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Invalid attachment storage key: ${key}`);
  }

  return resolvedPath;
}

export function createLocalAttachmentStorage(options = {}) {
  const rootDir = resolveRootDir(options);

  return {
    provider: "local",

    async initialize() {
      await mkdir(rootDir, { recursive: true });
      await access(rootDir);
    },

    async save({ key, content }) {
      const storedPath = resolveKey(rootDir, key);
      await mkdir(path.dirname(storedPath), { recursive: true });

      if (!content) {
        return {
          provider: "local",
          key: String(key).replaceAll("\\", "/"),
          saved: await this.exists({ key }),
        };
      }

      try {
        await access(storedPath);
      } catch {
        await writeFile(storedPath, content);
      }

      return {
        provider: "local",
        key: String(key).replaceAll("\\", "/"),
        saved: true,
      };
    },

    async read({ key }) {
      return readFile(resolveKey(rootDir, key));
    },

    async exists({ key }) {
      try {
        await access(resolveKey(rootDir, key));
        return true;
      } catch {
        return false;
      }
    },

    async delete({ key }) {
      try {
        await unlink(resolveKey(rootDir, key));
        return true;
      } catch (error) {
        if (error.code === "ENOENT") return false;
        throw error;
      }
    },
  };
}
