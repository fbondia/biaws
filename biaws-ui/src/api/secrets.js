import {
  buildUrl,
  deleteJson,
  fetchJson,
  readPayload,
  sendJson,
  workspaceHeaders,
} from "./client.js";
import { defaultMessagesService } from "../infrastructure/messages/runtime.js";

export function fetchSecrets(params) {
  return fetchJson("/api/secrets", params);
}

export function createSecret(secret) {
  return sendJson("/api/secrets", secret, undefined, "POST");
}

function secretFileForm(metadata, file) {
  const form = new FormData();
  for (const [key, value] of Object.entries(metadata || {})) {
    if (value === undefined || value === null || value === "") continue;
    form.append(key, value);
  }
  form.append("file", file);
  return form;
}

async function sendSecretFile(path, method, metadata, file) {
  return defaultMessagesService.run(
    async () => {
      const response = await fetch(buildUrl(path), {
        method,
        credentials: "include",
        headers: workspaceHeaders(),
        body: secretFileForm(metadata, file),
      });
      return readPayload(response);
    },
    "Criptografando arquivo…",
    { priority: 0 },
  );
}

export function createSecretFile(secret, file) {
  return sendSecretFile("/api/secrets/files", "POST", secret, file);
}

export function updateSecretMetadata(secretId, secret) {
  return sendJson(
    `/api/secrets/${encodeURIComponent(secretId)}`,
    secret,
    undefined,
    "PATCH",
  );
}

export function moveSecretToCollection(secretId, collectionId) {
  return sendJson(
    `/api/secrets/${encodeURIComponent(secretId)}/collection`,
    { collectionId },
    undefined,
    "PATCH",
  );
}

export function writeSecretValue(secretId, value) {
  return sendJson(`/api/secrets/${encodeURIComponent(secretId)}/value`, {
    value,
  });
}

export function writeSecretFile(secretId, file) {
  return sendSecretFile(
    `/api/secrets/${encodeURIComponent(secretId)}/file`,
    "PUT",
    {},
    file,
  );
}

export function revealSecretValue(secretId) {
  return retrieveSecretValue(secretId, "reveal", "Carregando segredo…");
}

export function copySecretValue(secretId) {
  return retrieveSecretValue(secretId, "copy", "Copiando segredo…");
}

function retrieveSecretValue(secretId, action, loadingLabel) {
  return defaultMessagesService.run(
    async () => {
      const response = await fetch(
        buildUrl(`/api/secrets/${encodeURIComponent(secretId)}/${action}`),
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
    loadingLabel,
    { priority: 0 },
  );
}

export function downloadSecretFile(secretId) {
  return defaultMessagesService.run(
    async () => {
      const response = await fetch(
        buildUrl(`/api/secrets/${encodeURIComponent(secretId)}/download`),
        {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: workspaceHeaders(),
        },
      );
      if (!response.ok) await readPayload(response);
      return {
        blob: await response.blob(),
        fileName: response.headers
          .get("Content-Disposition")
          ?.match(/filename\*=UTF-8''([^;]+)/iu)?.[1],
      };
    },
    "Baixando arquivo secreto…",
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

export function restoreSecret(secretId) {
  return sendJson(
    `/api/secrets/${encodeURIComponent(secretId)}/restore`,
    {},
    undefined,
    "POST",
  );
}

export function deleteSecret(secretId) {
  return deleteJson(`/api/secrets/${encodeURIComponent(secretId)}/permanent`);
}
