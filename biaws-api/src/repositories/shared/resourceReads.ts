import { textValue } from "../../helpers/text.js";
import type { RepositoryQuery } from "../../types/http.js";
import { getPagination } from "../../helpers/query.js";
import { referenceError } from "../../helpers/referenceLookup.js";
import { isRecord } from "../../helpers/records.js";

interface ResourceRoot {
  id?: string;
  workspaceId?: string;
  applicationId?: string | null;
}

interface ResourceParams {
  taskId?: string;
  attachmentId?: string;
}

export function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) {
    throw referenceError(404, "NOT_FOUND", "Resource not found");
  }
  return value;
}

export function byId<T extends { id?: unknown; _id?: unknown }>(
  items: readonly T[] | null | undefined,
  id: unknown,
): T {
  return required((items || []).find((item) => textValue(item.id || item._id || "") === textValue(id)));
}

export function pageResource<T>(items: readonly T[], query: RepositoryQuery = {}) {
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

export function publicAttachment(attachment: unknown) {
  if (!isRecord(attachment)) {
    throw referenceError(422, "INVALID_ATTACHMENT", "Attachment metadata is invalid");
  }
  const { storage, ...metadata } = attachment;
  return { ...metadata, id: attachment.id || String(attachment.index) };
}

export function resourceResponse(root: ResourceRoot, value: unknown, params: ResourceParams, query: RepositoryQuery) {
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

export function attachmentResourceResponse(
  root: ResourceRoot,
  attachments: readonly unknown[],
  params: ResourceParams,
  query: RepositoryQuery,
) {
  const context = {
    id: root.id,
    workspaceId: root.workspaceId,
    applicationId: root.applicationId,
    ...(params.taskId ? { taskId: params.taskId } : {}),
  };
  if (params.attachmentId) {
    const attachment = required(
      attachments.find(
        (file) => isRecord(file) && (file.id === params.attachmentId || String(file.index) === params.attachmentId),
      ),
    );
    return { context, value: publicAttachment(attachment) };
  }
  return { context, ...pageResource(attachments.map(publicAttachment), query) };
}
