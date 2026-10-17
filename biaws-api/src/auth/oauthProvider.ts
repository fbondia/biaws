import { mcp, type McpOptions } from "@better-auth/mcp";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { jwt } from "better-auth/plugins";
import type { Db } from "mongodb";

export const MCP_SCOPES = ["mcp:read", "mcp:write", "offline_access"];
const OAUTH_MODELS = [
  "jwks",
  "oauthClient",
  "oauthClientResource",
  "oauthResource",
  "oauthConsent",
  "oauthAccessToken",
  "oauthRefreshToken",
  "oauthClientAssertion",
];

function publicUrl(value: string) {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new Error(
      "MCP OAuth URLs must use HTTPS (HTTP loopback is allowed for development), without credentials, query or fragment.",
    );
  }
  return url.href.replace(/\/$/, "");
}

export function getMcpOAuthConfig(
  authBaseUrl: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const value = env.BIAWS_MCP_HTTP_ENABLED || "false";
  if (!["true", "false"].includes(value))
    throw new Error("BIAWS_MCP_HTTP_ENABLED must be true or false.");
  const enabled = value === "true";
  if (!enabled) return { enabled, resource: "", issuer: "" };
  return {
    enabled,
    resource: publicUrl(
      env.BIAWS_MCP_PUBLIC_URL || new URL("/mcp", authBaseUrl).href,
    ),
    issuer: publicUrl(new URL("/api/auth", authBaseUrl).href),
  };
}

export function createMcpOAuthPlugins(
  resource: string,
  options: Partial<McpOptions> = {},
) {
  return [
    jwt(),
    mcp({
      ...options,
      resource,
      loginPage: "/oauth/connect",
      consentPage: "/oauth/connect",
      scopes: MCP_SCOPES,
      grantTypes: ["authorization_code", "refresh_token"],
      allowDynamicClientRegistration: false,
      allowUnauthenticatedClientRegistration: false,
      refreshTokenReuseInterval: 0,
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
  ] as const;
}

export async function prepareOAuthStorage(database: Db) {
  const hello = await database.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== "isdbgrid")
    throw new Error(
      "MCP OAuth requires a MongoDB replica set for transactional token operations.",
    );
  const names = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray()).map(
      (c) => c.name,
    ),
  );
  for (const model of OAUTH_MODELS)
    if (!names.has(model)) await database.createCollection(model);
}

export async function warmOAuthIndexes(
  warmModel: (model: string) => Promise<unknown>,
) {
  for (const model of OAUTH_MODELS) {
    // No record is changed. Enter the adapter's write path to populate its
    // lazy index cache before it is used inside a transaction (P01 proof).
    await warmModel(model);
  }
}
