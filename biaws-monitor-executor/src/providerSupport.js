import net from "node:net";
import path from "node:path";

import { ProviderConfigurationError } from "./providers.js";

const SENSITIVE_NAME =
  /password|passwd|pwd|secret|token|credential|authorization|api[_-]?key/iu;

export function assertObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProviderConfigurationError(
      "INVALID_PROVIDER_CONFIGURATION",
      `${field} must be an object`,
    );
  }
  return value;
}

export function assertAllowedKeys(value, allowed, field = "configuration") {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    throw new ProviderConfigurationError(
      "UNKNOWN_PROVIDER_CONFIGURATION_FIELD",
      `${field} contains unsupported fields`,
    );
  }
}

export function boundedString(
  value,
  field,
  { required = false, max = 4_000 } = {},
) {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new ProviderConfigurationError(
        "MISSING_PROVIDER_CONFIGURATION_FIELD",
        `${field} is required`,
      );
    }
    return "";
  }
  if (typeof value !== "string" || value.length > max) {
    throw new ProviderConfigurationError(
      "INVALID_PROVIDER_CONFIGURATION_FIELD",
      `${field} must be a string with at most ${max} characters`,
    );
  }
  return value;
}

export function isPrivateAddress(address) {
  const normalized = address.toLowerCase().replace(/^::ffff:/u, "");
  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && [18, 19].includes(b)) ||
      (a === 198 && b === 51) ||
      (a === 203 && b === 0) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  if (!net.isIPv6(normalized)) return true;
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("2001:0:") ||
    normalized.startsWith("2001:db8:") ||
    normalized.startsWith("2002:") ||
    /^fe[89ab]/u.test(normalized) ||
    normalized.startsWith("ff")
  );
}

export function matchesHostPolicy(hostname, patterns) {
  const candidate = hostname.toLowerCase().replace(/\.$/u, "");
  return patterns.some((entry) => {
    const pattern = entry.toLowerCase().replace(/\.$/u, "");
    return pattern.startsWith("*.")
      ? candidate.endsWith(pattern.slice(1)) && candidate !== pattern.slice(2)
      : candidate === pattern;
  });
}

export function resolveInside(root, candidate, field) {
  const resolved = path.resolve(root, candidate || ".");
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ProviderConfigurationError(
      "PATH_OUTSIDE_POLICY_ROOT",
      `${field} is outside the configured shell policy root`,
    );
  }
  return resolved;
}

export function truncateBuffer(chunks, byteLimit) {
  const combined = Buffer.concat(chunks);
  return combined.subarray(0, byteLimit).toString("utf8");
}

export function truncateText(value, byteLimit) {
  return Buffer.from(String(value || ""))
    .subarray(0, byteLimit)
    .toString("utf8");
}

export function sensitiveValues(record = {}) {
  return Object.entries(record)
    .filter(([name, value]) => SENSITIVE_NAME.test(name) && value)
    .map(([, value]) => String(value));
}

export function sanitizeEvidenceText(value, values = []) {
  let sanitized = String(value || "");
  for (const sensitive of values) {
    if (sensitive.length >= 4)
      sanitized = sanitized.replaceAll(sensitive, "[REDACTED]");
  }
  return sanitized
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/giu, "$1[REDACTED]")
    .replace(
      /(["']?(?:password|passwd|pwd|secret|token|credential|authorization|api[_-]?key)["']?\s*[:=]\s*["']?)[^\s,"'};]+/giu,
      "$1[REDACTED]",
    );
}
