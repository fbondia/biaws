import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { ProviderConfigurationError } from "./providers.js";

const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]{0,99}$/u;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const MAX_SECRET_BYTES = 64 * 1024;
const RESERVED_FILES = new Set(["executor-api-key"]);

export function createEnvironmentReferenceResolver(
  mapping = {},
  env = process.env,
) {
  const normalized = new Map();
  for (const [reference, environmentName] of Object.entries(mapping)) {
    if (!REFERENCE.test(reference) || !ENVIRONMENT_NAME.test(environmentName)) {
      throw new Error("Reference environment map contains an invalid entry");
    }
    normalized.set(reference, environmentName);
  }
  return async function resolveReference(reference) {
    if (!REFERENCE.test(reference) || !normalized.has(reference)) {
      throw new ProviderConfigurationError(
        "REFERENCE_NOT_ALLOWED",
        "Referenced value is not present in the local allowlist",
      );
    }
    const value = env[normalized.get(reference)];
    if (typeof value !== "string" || value.length === 0) {
      throw new ProviderConfigurationError(
        "REFERENCE_NOT_AVAILABLE",
        "Referenced value is not available in this executor",
      );
    }
    return value;
  };
}

export function createReferenceResolver(
  { environment = {}, files = {}, fileRoot = "/run/secrets" } = {},
  { env = process.env } = {},
) {
  const resolveEnvironment = createEnvironmentReferenceResolver(
    environment,
    env,
  );
  const fileReferences = new Map();
  for (const [reference, fileName] of Object.entries(files)) {
    if (
      !REFERENCE.test(reference) ||
      !FILE_NAME.test(fileName) ||
      RESERVED_FILES.has(fileName)
    ) {
      throw new Error("Reference file map contains an invalid entry");
    }
    fileReferences.set(reference, fileName);
  }
  const environmentReferences = new Set(Object.keys(environment));
  for (const reference of fileReferences.keys()) {
    if (environmentReferences.has(reference)) {
      throw new Error("A reference cannot use environment and file sources");
    }
  }
  const configuredRoot = path.resolve(fileRoot);

  return async function resolveReference(reference) {
    if (environmentReferences.has(reference)) {
      return resolveEnvironment(reference);
    }
    if (!REFERENCE.test(reference) || !fileReferences.has(reference)) {
      throw new ProviderConfigurationError(
        "REFERENCE_NOT_ALLOWED",
        "Referenced value is not present in the local allowlist",
      );
    }
    try {
      const canonicalRoot = await realpath(configuredRoot);
      const canonicalFile = await realpath(
        path.join(canonicalRoot, fileReferences.get(reference)),
      );
      if (
        `${canonicalFile}${path.sep}`.startsWith(
          `${canonicalRoot}${path.sep}`,
        ) === false
      ) {
        throw new Error("Reference file escaped its configured root");
      }
      const details = await stat(canonicalFile);
      if (
        !details.isFile() ||
        details.size < 1 ||
        details.size > MAX_SECRET_BYTES
      ) {
        throw new Error("Reference file has an invalid size or type");
      }
      const value = await readFile(canonicalFile, "utf8");
      const normalized = value.replace(/\r?\n$/u, "");
      if (!normalized) throw new Error("Reference file is empty");
      return normalized;
    } catch {
      throw new ProviderConfigurationError(
        "REFERENCE_NOT_AVAILABLE",
        "Referenced value is not available in this executor",
      );
    }
  };
}
