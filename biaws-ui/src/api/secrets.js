import {
  buildUrl,
  fetchJson,
  readPayload,
  sendJson,
  workspaceHeaders,
} from "./client.js";
import { runWithGlobalLoading } from "../loadingStore.js";

export function fetchSecrets(params) {
  return fetchJson("/api/secrets", params);
}

export function createSecret(secret) {
  return sendJson("/api/secrets", secret, undefined, "POST");
}

export function updateSecretMetadata(secretId, secret) {
  return sendJson(
    `/api/secrets/${encodeURIComponent(secretId)}`,
    secret,
    undefined,
    "PATCH",
  );
}

export function writeSecretValue(secretId, value) {
  return sendJson(`/api/secrets/${encodeURIComponent(secretId)}/value`, {
    value,
  });
}

export function revealSecretValue(secretId) {
  return runWithGlobalLoading(
    async () => {
      const response = await fetch(
        buildUrl(`/api/secrets/${encodeURIComponent(secretId)}/reveal`),
        {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: workspaceHeaders({ "Content-Type": "application/json" }),
          body: "{}",
        },
      );
      return readPayload(response);
    },
    "Revelando segredo…",
    { priority: 0 },
  );
}

export function archiveSecret(secretId) {
  return sendJson(
    `/api/secrets/${encodeURIComponent(secretId)}/archive`,
    {},
    undefined,
    "POST",
  );
}
