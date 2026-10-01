import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { BiawsError } from "../../runtime/errors.js";

const DEFAULT_MAX_EML_BYTES = 25 * 1024 * 1024;
const HARD_MAX_EML_BYTES = 50 * 1024 * 1024;

function fileError(message: string, code: string, statusCode = 422) {
  const error = new BiawsError(message);
  error.code = code;
  error.statusCode = statusCode;
  error.retryable = false;
  return error;
}

function maxEmlBytes() {
  const configured = Number(process.env.BIAWS_MCP_MAX_EML_BYTES);
  if (!Number.isFinite(configured) || configured <= 0) return DEFAULT_MAX_EML_BYTES;
  return Math.min(Math.floor(configured), HARD_MAX_EML_BYTES);
}

function configuredRootPaths() {
  return String(process.env.BIAWS_MCP_EML_IMPORT_ROOTS || "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isWithinRoot(filename: string, root: string) {
  const relative = path.relative(root, filename);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function allowedRoots() {
  const configured = configuredRootPaths();
  if (!configured.length) {
    throw fileError(
      "Local EML access is disabled; configure BIAWS_MCP_EML_IMPORT_ROOTS with an approved upload directory",
      "LOCAL_EML_ACCESS_DISABLED",
      403,
    );
  }
  try {
    return await Promise.all(
      configured.map(async (root) => {
        const resolved = await realpath(path.resolve(root));
        if (!(await lstat(resolved)).isDirectory()) throw new Error("not a directory");
        return resolved;
      }),
    );
  } catch {
    throw fileError("An EML import root is unavailable", "EML_IMPORT_ROOT_UNAVAILABLE", 500);
  }
}

export interface LocalEmlFile {
  content: Buffer;
  filename: string;
  sha256: string;
  size: number;
}

export async function readLocalEml(filePath: unknown): Promise<LocalEmlFile> {
  const requestedPath = String(filePath || "").trim();
  if (!requestedPath) throw fileError("filePath is required", "INVALID_EML_FILE");
  if (!path.isAbsolute(requestedPath)) {
    throw fileError("filePath must be absolute", "INVALID_EML_FILE");
  }
  if (!requestedPath.toLowerCase().endsWith(".eml")) {
    throw fileError("filePath must end with .eml", "INVALID_EML_FILE");
  }

  try {
    if ((await lstat(requestedPath)).isSymbolicLink()) {
      throw fileError("Symbolic links are not accepted for EML imports", "INVALID_EML_FILE");
    }
  } catch (error) {
    if (error instanceof BiawsError) throw error;
    throw fileError("EML file was not found or is not accessible", "EML_FILE_NOT_FOUND", 404);
  }

  let resolvedPath: string;
  try {
    resolvedPath = await realpath(requestedPath);
  } catch {
    throw fileError("EML file was not found or is not accessible", "EML_FILE_NOT_FOUND", 404);
  }
  const roots = await allowedRoots();
  if (!roots.some((root) => isWithinRoot(resolvedPath, root))) {
    throw fileError("EML file is outside the approved import roots", "EML_FILE_OUTSIDE_ALLOWED_ROOT", 403);
  }

  let handle;
  try {
    handle = await open(resolvedPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = await handle.stat();
    if (!metadata.isFile()) throw fileError("filePath must reference a regular file", "INVALID_EML_FILE");
    if (!metadata.size) throw fileError("EML file is empty", "INVALID_EML_FILE");
    const limit = maxEmlBytes();
    if (metadata.size > limit) {
      throw fileError(`EML file exceeds the MCP limit of ${limit} bytes`, "EML_FILE_TOO_LARGE", 413);
    }
    const content = await handle.readFile();
    if (!content.length) throw fileError("EML file is empty", "INVALID_EML_FILE");
    if (content.length > limit) {
      throw fileError(`EML file exceeds the MCP limit of ${limit} bytes`, "EML_FILE_TOO_LARGE", 413);
    }
    return {
      content,
      filename: path.basename(resolvedPath),
      sha256: createHash("sha256").update(content).digest("hex"),
      size: content.length,
    };
  } catch (error) {
    if (error instanceof BiawsError) throw error;
    throw fileError("EML file could not be read safely", "EML_FILE_READ_FAILED", 422);
  } finally {
    await handle?.close();
  }
}

export function assertExpectedEmlHash(actualSha256: string, expectedSha256: unknown) {
  const expected = String(expectedSha256 || "")
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(expected)) {
    throw fileError("expectedSha256 must be a lowercase SHA-256 digest", "INVALID_EML_HASH");
  }
  if (actualSha256 !== expected) {
    throw fileError("EML file changed after analysis; analyze it again before importing", "EML_FILE_CHANGED", 409);
  }
}
