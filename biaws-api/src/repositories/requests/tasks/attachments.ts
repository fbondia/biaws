import type { RepositoryQuery } from "../../../types/http.js";
import { getRequest } from "../queries.js";
import { resolveTaskReference } from "../../shared/references.js";
import { referenceError } from "../../../helpers/referenceLookup.js";

interface TaskAttachment {
  id?: string;
  index?: number;
  tags?: string[];
}

function isTaskAttachment(value: unknown): value is TaskAttachment {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function taskAttachmentContext(
  demandReference: string | string[],
  taskReference: string | string[],
  query: RepositoryQuery = {},
  attachmentId?: string | string[],
) {
  const request = (await getRequest(demandReference, query)).request;
  if (!request) throw referenceError(404, "NOT_FOUND", "Request not found");
  const taskId = await resolveTaskReference(taskReference, request.id, query);
  const task = request.tasks.find((item) => item.id === taskId);
  if (!task) throw referenceError(404, "NOT_FOUND", "Task not found");
  const tag = String(task.code || "")
    .trim()
    .toLowerCase();

  if (
    tag &&
    request.tasks.filter(
      (item) =>
        String(item.code || "")
          .trim()
          .toLowerCase() === tag,
    ).length > 1
  ) {
    throw referenceError(
      409,
      "AMBIGUOUS_TASK_FILES",
      "The task code is shared by multiple tasks; assign a unique code before accessing its files",
    );
  }
  const attachments = tag
    ? (request.attachments || [])
        .filter(isTaskAttachment)
        .filter((file) => (file.tags || []).includes(tag))
    : [];
  if (
    attachmentId &&
    !attachments.some(
      (file) =>
        file.id === attachmentId || String(file.index) === String(attachmentId),
    )
  ) {
    throw referenceError(404, "NOT_FOUND", "File does not belong to this task");
  }
  return { request, task, tag, attachments };
}
