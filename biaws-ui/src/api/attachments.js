import { buildUrl, deleteJson, sendJson, workspaceHeaders } from "./client.js";

export async function uploadEntityAttachments(
  entityType,
  entityId,
  files,
  { tags = [] } = {},
) {
  const form = new FormData();
  for (const file of files) form.append("files", file, file.name);
  if (tags.length) form.append("tags", JSON.stringify(tags));

  const response = await fetch(
    buildUrl(`/api/${entityType}/${encodeURIComponent(entityId)}/attachments`),
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

export async function downloadEntityAttachment(
  entityType,
  entityId,
  attachment,
) {
  const blob = await fetchEntityAttachment(entityType, entityId, attachment);
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = attachment.filename || "anexo";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export async function fetchEntityAttachment(entityType, entityId, attachment) {
  const attachmentId = attachment.id ?? attachment.index;
  const response = await fetch(
    buildUrl(
      `/api/${entityType}/${encodeURIComponent(entityId)}/attachments/${encodeURIComponent(attachmentId)}`,
    ),
    { credentials: "include", headers: workspaceHeaders() },
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || `HTTP ${response.status}`);
  }

  return response.blob();
}

export async function deleteEntityAttachment(entityType, entityId, attachment) {
  const attachmentId = attachment.id ?? attachment.index;
  return deleteJson(
    `/api/${entityType}/${encodeURIComponent(entityId)}/attachments/${encodeURIComponent(attachmentId)}`,
  );
}

export function updateEntityAttachmentTags(
  entityType,
  entityId,
  attachment,
  tags,
) {
  const attachmentId = attachment.id ?? attachment.index;
  return sendJson(
    `/api/${entityType}/${encodeURIComponent(entityId)}/attachments/${encodeURIComponent(attachmentId)}/tags`,
    { tags },
    undefined,
    "PATCH",
  );
}
