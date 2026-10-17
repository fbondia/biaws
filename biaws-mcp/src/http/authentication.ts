import type { ApiIdentity } from "../runtime/requestContext.js";
import { BiawsError } from "../runtime/errors.js";
import type { HttpConfig } from "./config.js";
export interface DelegatedIdentity extends ApiIdentity {
  grantId: string;
  scopes: string[];
}
export function authenticationChallenge(config: HttpConfig, status = 401) {
  const metadata = new URL("/.well-known/oauth-protected-resource" + config.publicUrl.pathname, config.publicUrl);
  return new Response(JSON.stringify({ error: status === 403 ? "insufficient_scope" : "invalid_token" }), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "www-authenticate": `Bearer resource_metadata="${metadata.href}", scope="mcp:read mcp:write"`,
    },
  });
}
export async function delegateIdentity(
  request: Request,
  config: HttpConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<DelegatedIdentity> {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+([^\s]+)$/i);
  if (!match || match[1].length > 16384)
    throw Object.assign(new BiawsError("OAuth authentication required"), { statusCode: 401 });
  const response = await fetchImpl(new URL("/api/auth/mcp/delegate", config.apiUrl), {
    method: "POST",
    headers: { "content-type": "application/json", "x-biaws-mcp-service-secret": config.serviceSecret },
    body: JSON.stringify({ subject_token: match[1] }),
    signal: AbortSignal.any([request.signal, AbortSignal.timeout(15000)]),
    redirect: "error",
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok)
    throw Object.assign(new BiawsError("OAuth delegation failed"), {
      statusCode:
        response.status === 401 ? 401 : response.status === 403 && payload.error === "insufficient_scope" ? 403 : 503,
    });
  if (
    typeof payload.accessToken !== "string" ||
    !payload.accessToken.startsWith("biaws_dlg_") ||
    typeof payload.workspaceId !== "string" ||
    !payload.workspaceId ||
    typeof payload.grantId !== "string" ||
    typeof payload.expiresAt !== "string" ||
    !(Date.parse(payload.expiresAt) > Date.now()) ||
    !Array.isArray(payload.scopes) ||
    !payload.scopes.every((s) => typeof s === "string") ||
    !payload.scopes.includes("mcp:read")
  )
    throw new BiawsError("Invalid delegation response");
  return {
    token: payload.accessToken,
    workspaceId: payload.workspaceId,
    grantId: payload.grantId,
    scopes: payload.scopes,
  };
}
