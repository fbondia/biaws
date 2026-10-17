import { readFileSync, statSync } from "node:fs";
export interface HttpConfig {
  host: string;
  port: number;
  publicUrl: URL;
  issuer: URL;
  apiUrl: URL;
  serviceSecret: string;
  maxBodyBytes: number;
  maxInFlight: number;
  requestsPerMinute: number;
}
function integer(value: string | undefined, fallback: number, max: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max)
    throw new Error("Invalid MCP HTTP numeric configuration");
  return number;
}
export function httpConfig(env: NodeJS.ProcessEnv = process.env): HttpConfig {
  const publicUrl = new URL(env.BIAWS_MCP_PUBLIC_URL || "http://127.0.0.1:3120/mcp");
  if (
    publicUrl.username ||
    publicUrl.password ||
    publicUrl.search ||
    publicUrl.hash ||
    (publicUrl.protocol !== "https:" &&
      !(publicUrl.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(publicUrl.hostname)))
  )
    throw new Error("MCP public URL requires HTTPS or development loopback");
  const apiUrl = new URL(env.BIAWS_API_URL || "http://127.0.0.1:3100");
  if (!["http:", "https:"].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password)
    throw new Error("Invalid internal API URL");
  const issuer = new URL("/api/auth", env.BETTER_AUTH_URL || env.BIAWS_PUBLIC_URL || publicUrl.origin);
  if (
    issuer.username ||
    issuer.password ||
    (issuer.protocol !== "https:" &&
      !(issuer.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(issuer.hostname)))
  )
    throw new Error("OAuth issuer requires a trusted public HTTPS URL");
  let serviceSecret = env.BIAWS_MCP_SERVICE_SECRET || "";
  if (env.BIAWS_MCP_SERVICE_SECRET_FILE) {
    if (statSync(env.BIAWS_MCP_SERVICE_SECRET_FILE).size > 4096)
      throw new Error("MCP service secret file is too large");
    serviceSecret = readFileSync(env.BIAWS_MCP_SERVICE_SECRET_FILE, "utf8").trim();
  }
  if (serviceSecret.length < 32)
    throw new Error("Configure a dedicated MCP service secret with at least 32 characters");
  return {
    host: env.BIAWS_MCP_HTTP_HOST || "127.0.0.1",
    port: integer(env.BIAWS_MCP_HTTP_PORT, 3120, 65535),
    publicUrl,
    issuer,
    apiUrl,
    serviceSecret,
    maxBodyBytes: integer(env.BIAWS_MCP_MAX_REQUEST_BYTES, 16 * 1024 * 1024, 64 * 1024 * 1024),
    maxInFlight: integer(env.BIAWS_MCP_MAX_IN_FLIGHT, 32, 256),
    requestsPerMinute: integer(env.BIAWS_MCP_REQUESTS_PER_MINUTE, 600, 100000),
  };
}
