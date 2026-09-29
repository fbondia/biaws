import { getRequest } from "../queries.js";
import { resolveTaskReference } from "../../shared/references.js";
import { referenceError } from "../../../helpers/referenceLookup.js";

export async function taskAttachmentContext(
  demandReference,
  taskReference,
  query = {},
  attachmentId,
) {
  const request = (await getRequest(demandReference, query)).request;
  const taskId = await resolveTaskReference(taskReference, request.id, query);
  const task = request.tasks.find((item) => item.id === taskId);
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
    ? (request.attachments || []).filter((file) =>
        (file.tags || []).includes(tag),
      )
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
