import { buildUrl, fetchJson, sendJson, workspaceHeaders } from "./client.js";

export async function importEml(
  file,
  {
    dryRun = false,
    type,
    id,
    title,
    workspaceId,
    applicationId,
    affectedComponentIds = [],
    sanitizationConfig,
  } = {},
) {
  const form = new FormData();
  form.append("file", file, file.name);
  if (type) form.append("type", type);
  if (id) form.append("id", id);
  if (title) form.append("title", title);
  if (workspaceId) form.append("workspaceId", workspaceId);
  if (applicationId) form.append("applicationId", applicationId);
  if (affectedComponentIds.length) {
    form.append("affectedComponentIds", JSON.stringify(affectedComponentIds));
  }
  if (dryRun && sanitizationConfig) {
    form.append("sanitizationConfig", JSON.stringify(sanitizationConfig));
  }

  const response = await fetch(
    buildUrl("/api/issues/imports/eml", { dryRun }),
    {
      method: "POST",
      credentials: "include",
      headers: workspaceHeaders(),
      body: form,
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(payload.error?.message || `HTTP ${response.status}`);
  return payload;
}

export function fetchEmlSanitizationConfiguration() {
  return fetchJson("/api/issues/imports/eml/sanitization");
}

export function saveEmlSanitizationConfiguration(config) {
  return sendJson("/api/issues/imports/eml/sanitization", { config });
}
