import { createHash } from "node:crypto";
import type { Actor } from "../types/http.js";

export function oauthError(code: string, statusCode = 401) {
  return Object.assign(
    new Error(
      "The OAuth authorization is invalid or no longer permits this operation.",
    ),
    { code, statusCode },
  );
}

export function oauthFlow(query: string) {
  if (!query || query.length > 16384)
    throw oauthError("INVALID_OAUTH_FLOW", 400);
  const params = new URLSearchParams(query);
  const fields = [
    "client_id",
    "redirect_uri",
    "state",
    "code_challenge",
    "code_challenge_method",
  ];
  for (const name of fields)
    if (params.getAll(name).length !== 1 || !params.get(name))
      throw oauthError("INVALID_OAUTH_FLOW", 400);
  if (params.get("code_challenge_method") !== "S256")
    throw oauthError("INVALID_OAUTH_FLOW", 400);
  const canonical = fields.map((k) => [k, params.get(k)]);
  const scopes = [
    ...new Set((params.get("scope") || "").split(/\s+/).filter(Boolean)),
  ].sort();
  if (
    scopes.some(
      (s) => !["mcp:read", "mcp:write", "offline_access"].includes(s),
    ) ||
    !scopes.includes("mcp:read")
  )
    throw oauthError("INVALID_OAUTH_SCOPES", 400);
  canonical.push(
    ["scope", scopes.join(" ")],
    ["resource", params.getAll("resource").sort().join(" ")],
  );
  return {
    key: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
    clientId: params.get("client_id")!,
    scopes,
  };
}

export function restrictOAuthActor(
  actor: Actor,
  scopes: string[],
  grant: { id: string; clientId: string; workspaceId: string },
): Actor {
  if (actor.workspaceId !== grant.workspaceId || !scopes.includes("mcp:read"))
    throw oauthError("INVALID_OAUTH_SCOPE", 403);
  const write = scopes.includes("mcp:write");
  const permissions = (actor.permissions || []).filter(
    (p) => (write || p.endsWith(".read")) && !p.startsWith("secrets.value."),
  );
  return {
    ...actor,
    authenticationMethod: "oauth-delegated",
    sessionId: null,
    apiKeyId: null,
    platformPermissions: [],
    workspaces: (actor.workspaces || []).filter(
      (w) => w.id === grant.workspaceId,
    ),
    permissions,
    permissionScopes: Object.fromEntries(
      Object.entries(actor.permissionScopes || {}).filter(([p]) =>
        permissions.includes(p),
      ),
    ),
    oauthGrantId: grant.id,
    oauthClientId: grant.clientId,
    oauthScopes: [...scopes],
  };
}
