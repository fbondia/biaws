import { getPagination } from "../../helpers/query.js";
import { referenceError } from "../../helpers/referenceLookup.js";

export function required(value) {
  if (value === undefined || value === null) {
    throw referenceError(404, "NOT_FOUND", "Resource not found");
  }
  return value;
}

export function byId(items, id) {
  return required(
    (items || []).find(
      (item) => String(item.id || item._id || "") === String(id),
    ),
  );
}

export function pageResource(items, query = {}) {
  const { page, limit, skip } = getPagination(query);
  return {
    items: items.slice(skip, skip + limit),
    meta: {
      page,
      limit,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / limit)),
    },
  };
}

export function publicAttachment(attachment) {
  const { storage, ...metadata } = attachment;
  return { ...metadata, id: attachment.id || String(attachment.index) };
}

export function resourceResponse(root, value, params, query) {
  const context = {
    id: root.id,
    workspaceId: root.workspaceId,
    applicationId: root.applicationId,
    ...(params.taskId ? { taskId: params.taskId } : {}),
  };
  return {
    context,
    ...(Array.isArray(value) ? pageResource(value, query) : { value }),
  };
}

export function attachmentResourceResponse(root, attachments, params, query) {
  const context = {
    id: root.id,
    workspaceId: root.workspaceId,
    applicationId: root.applicationId,
    ...(params.taskId ? { taskId: params.taskId } : {}),
  };
  if (params.attachmentId) {
    const attachment = required(
      attachments.find(
        (file) =>
          file.id === params.attachmentId ||
          String(file.index) === params.attachmentId,
      ),
    );
    return { context, value: publicAttachment(attachment) };
  }
  return { context, ...pageResource(attachments.map(publicAttachment), query) };
}
