import {
  cleanParams,
  deleteJson,
  fetchBinary,
  fetchJson,
  sendJson,
  sendMultipart,
} from "../../httpClient.js";

const DEFAULT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const HARD_MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024;

const ENTITY_PATHS = {
  issue: "issues",
  demand: "requests",
  procedure: "procedures",
};

function domainError(message, code = "INVALID_ATTACHMENT_INPUT", status = 422) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = status;
  error.retryable = false;
  return error;
}

function maxAttachmentBytes() {
  const configured = Number(process.env.BIAWS_MCP_MAX_ATTACHMENT_BYTES);
  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_MAX_ATTACHMENT_BYTES;
  }
  return Math.min(Math.floor(configured), HARD_MAX_ATTACHMENT_BYTES);
}

function decodeBase64(value, filename) {
  const encoded = String(value || "").replace(/\s+/gu, "");
  if (!encoded) {
    throw domainError(`contentBase64 is required for ${filename}`);
  }
  if (
    encoded.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(
      encoded,
    )
  ) {
    throw domainError(`contentBase64 is invalid for ${filename}`);
  }

  const limit = maxAttachmentBytes();
  const paddingBytes = encoded.endsWith("==")
    ? 2
    : encoded.endsWith("=")
      ? 1
      : 0;
  const decodedBytes = (encoded.length / 4) * 3 - paddingBytes;
  if (decodedBytes > limit) {
    throw domainError(
      `Attachment ${filename} exceeds the MCP limit of ${limit} bytes`,
      "ATTACHMENT_TOO_LARGE",
      413,
    );
  }
  const content = Buffer.from(encoded, "base64");
  if (!content.length) {
    throw domainError(`contentBase64 is empty for ${filename}`);
  }
  return content;
}

function normalizedTags(tags = []) {
  return [
    ...new Set(
      tags
        .map((tag) =>
          String(tag || "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  ];
}

function findAttachment(attachments, attachmentId) {
  const id = String(attachmentId);
  return (attachments || []).find(
    (attachment) =>
      String(attachment.id || "") === id || String(attachment.index) === id,
  );
}

async function resolveTarget(args, { verifyAttachment = false } = {}) {
  const entityType = String(args.entityType || "").trim();
  const entityId = String(args.entityId || "").trim();
  if (!ENTITY_PATHS[entityType] && entityType !== "task") {
    throw domainError(`Unsupported attachment entity: ${entityType}`);
  }
  if (!entityId) throw domainError("entityId is required");

  if (entityType !== "task") {
    return {
      entityPath: ENTITY_PATHS[entityType],
      entityId,
      tags: normalizedTags(args.tags),
    };
  }

  const taskId = String(args.taskId || "").trim();
  if (!taskId) {
    throw domainError("taskId is required when entityType is task");
  }
  const payload = await fetchJson(
    `/api/requests/${encodeURIComponent(entityId)}`,
    cleanParams({
      workspaceId: args.workspaceId,
      applicationId: args.applicationId,
      componentId: args.componentId,
    }),
  );
  const request = payload.request;
  if (!request) {
    throw domainError(`Demand not found: ${entityId}`, "NOT_FOUND", 404);
  }
  const task = (request.tasks || []).find(
    (item) =>
      String(item.id || "") === taskId ||
      String(item.code || "").toLowerCase() === taskId.toLowerCase(),
  );
  if (!task) {
    throw domainError(`Task not found: ${taskId}`, "NOT_FOUND", 404);
  }
  const taskTag = String(task.code || "")
    .trim()
    .toLowerCase();
  if (!taskTag) {
    throw domainError(
      `Task ${taskId} must have a code before files can be associated with it`,
    );
  }

  let attachment;
  if (verifyAttachment) {
    attachment = findAttachment(request.attachments, args.attachmentId);
    if (!attachment) {
      throw domainError(
        `Attachment not found: ${args.attachmentId}`,
        "NOT_FOUND",
        404,
      );
    }
    const belongsToTask = normalizedTags(attachment.tags).includes(taskTag);
    if (!belongsToTask) {
      throw domainError(
        `Attachment ${args.attachmentId} is not associated with task ${taskId}`,
        "ATTACHMENT_NOT_ASSOCIATED_WITH_TASK",
        404,
      );
    }
  }

  return {
    entityPath: "requests",
    entityId: request.id,
    task,
    attachment,
    tags: normalizedTags([...(args.tags || []), taskTag]),
  };
}

function requestParams(args) {
  return cleanParams({
    workspaceId: args.workspaceId,
    applicationId: args.applicationId,
    componentId: args.componentId,
  });
}

function attachmentPath(target, attachmentId, suffix = "") {
  return `/api/${target.entityPath}/${encodeURIComponent(target.entityId)}/attachments/${encodeURIComponent(attachmentId)}${suffix}`;
}

function filenameFromDisposition(value) {
  const disposition = String(value || "");
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/iu)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      return encoded;
    }
  }
  return disposition.match(/filename="([^"]*)"/iu)?.[1] || "attachment";
}

export async function uploadAttachments(args = {}) {
  const target = await resolveTarget(args);
  const form = new FormData();
  for (const file of args.files || []) {
    const filename = String(file.filename || "").trim();
    if (!filename) throw domainError("filename is required for every file");
    const content = decodeBase64(file.contentBase64, filename);
    form.append(
      "files",
      new Blob([content], {
        type: String(file.contentType || "application/octet-stream"),
      }),
      filename,
    );
  }
  if (target.tags.length) form.append("tags", JSON.stringify(target.tags));

  return sendMultipart(
    `/api/${target.entityPath}/${encodeURIComponent(target.entityId)}/attachments`,
    form,
    requestParams(args),
  );
}

export async function downloadAttachment(args = {}) {
  const target = await resolveTarget(args, {
    verifyAttachment: args.entityType === "task",
  });
  const { content, headers } = await fetchBinary(
    attachmentPath(target, args.attachmentId),
    requestParams(args),
    { maxBytes: maxAttachmentBytes() },
  );
  return {
    entityType: args.entityType,
    entityId: args.entityId,
    ...(args.entityType === "task" ? { taskId: args.taskId } : {}),
    attachmentId: args.attachmentId,
    filename: filenameFromDisposition(headers.get("content-disposition")),
    contentType: headers.get("content-type") || "application/octet-stream",
    size: content.length,
    contentBase64: content.toString("base64"),
  };
}

export async function updateAttachmentTags(args = {}) {
  const target = await resolveTarget(args, {
    verifyAttachment: args.entityType === "task",
  });
  return sendJson(
    attachmentPath(target, args.attachmentId, "/tags"),
    { tags: target.tags },
    requestParams(args),
    "PATCH",
  );
}

export async function deleteAttachment(args = {}) {
  const target = await resolveTarget(args, {
    verifyAttachment: args.entityType === "task",
  });
  return deleteJson(
    attachmentPath(target, args.attachmentId),
    requestParams(args),
  );
}
