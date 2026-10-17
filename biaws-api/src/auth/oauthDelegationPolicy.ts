import { timingSafeEqual, createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { oauthError } from "./oauthGrantPolicy.js";

export const DELEGATION_PREFIX = "biaws_dlg_";
export const hashDelegation = (token: string) => createHash("sha256").update(token).digest("hex");

export function classifyMcpDelegationFailure(error: unknown) {
  const e = error as { statusCode?: number; code?: string };
  const code = typeof e?.code === "string" ? e.code : "";
  const cryptographicFailure = /^ERR_(?:JOSE|JWT|JWS|JWK|JWKS)_/u.test(code);
  if (!e?.statusCode && !cryptographicFailure) return null;
  const status =
    e.statusCode && e.statusCode >= 500
      ? "SERVICE_UNAVAILABLE"
      : code === "INSUFFICIENT_MCP_SCOPE" || code === "MCP_SERVICE_FORBIDDEN"
        ? "FORBIDDEN"
        : "UNAUTHORIZED";
  const kind =
    code === "INSUFFICIENT_MCP_SCOPE"
      ? "insufficient_scope"
      : code.startsWith("MCP_SERVICE")
        ? "invalid_client"
        : "invalid_token";
  return { status, error: kind } as const;
}

export function requireMcpServiceSecret(header: string | null, env: NodeJS.ProcessEnv = process.env) {
  let expected = env.BIAWS_MCP_SERVICE_SECRET || "";
  if (env.BIAWS_MCP_SERVICE_SECRET_FILE) {
    const file = env.BIAWS_MCP_SERVICE_SECRET_FILE;
    if (statSync(file).size > 4096) throw oauthError("MCP_SERVICE_UNAVAILABLE", 503);
    expected = readFileSync(file, "utf8").trim();
  }
  if (expected.length < 32) throw oauthError("MCP_SERVICE_UNAVAILABLE", 503);
  const provided = Buffer.from(header || ""),
    secret = Buffer.from(expected);
  if (provided.length !== secret.length || !timingSafeEqual(provided, secret))
    throw oauthError("MCP_SERVICE_FORBIDDEN", 403);
}

export function mcpSubjectClaims(claims: Record<string, unknown>, resource: string, now = Date.now()) {
  if (
    !claims.active ||
    !claims.sub ||
    !claims.client_id ||
    !Array.of(claims.aud).flat().includes(resource) ||
    typeof claims.exp !== "number" ||
    claims.exp * 1000 <= now ||
    typeof claims.biaws_grant_id !== "string"
  )
    throw oauthError("INVALID_MCP_TOKEN");
  const scopes = typeof claims.scope === "string" ? claims.scope.split(/\s+/).filter(Boolean) : [];
  if (!scopes.includes("mcp:read")) throw oauthError("INSUFFICIENT_MCP_SCOPE", 403);
  return {
    userId: String(claims.sub),
    clientId: String(claims.client_id),
    grantId: claims.biaws_grant_id,
    workspaceId: String(claims.biaws_workspace_id || ""),
    scopes,
    expiresAt: new Date(Math.min(claims.exp * 1000, now + 60_000)),
  };
}
