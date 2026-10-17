import { deleteJson, fetchJson, sendJson } from "./client.js";

export const oauthContext = (query) => sendJson("/api/oauth/context", { query }, undefined, "POST");
export const oauthDecision = (query, accept, workspaceId) =>
  sendJson("/api/oauth/decision", { query, accept, ...(workspaceId ? { workspaceId } : {}) }, undefined, "POST");
export const listOAuthConnections = () => fetchJson("/api/oauth/connections");
export const revokeOAuthConnection = (id) => deleteJson("/api/oauth/connections/" + encodeURIComponent(id));

export function scopeLabels(scopes) {
  return scopes.map(
    (scope) =>
      ({
        "mcp:read": "Consultar dados permitidos",
        "mcp:write": "Alterar dados conforme suas permissões",
        offline_access: "Manter a conexão entre sessões",
      })[scope] || scope,
  );
}
