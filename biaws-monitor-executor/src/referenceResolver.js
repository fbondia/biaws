import { ProviderConfigurationError } from "./providers.js";

const REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;
const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]{0,99}$/u;

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
