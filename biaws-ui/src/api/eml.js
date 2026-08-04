import {
  buildUrl,
  fetchJson,
  readPayload,
  sendJson,
  workspaceHeaders,
} from "./client.js";

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
    classification,
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
  if (classification) {
    form.append("classification", JSON.stringify(classification));
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
  return readPayload(response);
}

export function fetchEmlSanitizationConfiguration() {
  return fetchJson("/api/issues/imports/eml/sanitization");
}

export function saveEmlSanitizationConfiguration(config) {
  return sendJson("/api/issues/imports/eml/sanitization", { config });
}
