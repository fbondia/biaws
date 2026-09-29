import { taskAttachmentContext } from "../repositories/requests/tasks/attachments.js";
import { referenceError } from "../helpers/referenceLookup.js";
import type { RepositoryQuery } from "../types/http.js";
import {
  uploadAttachments,
  updateAttachmentTags,
  deleteAttachment,
  parseUploadTags,
} from "./attachmentService.js";

export async function mutateTaskAttachments(
  operation: "upload" | "tags" | "delete",
  demandId: string | string[],
  taskId: string | string[],
  input: {
    files?: Express.Multer.File[];
    tags?: unknown;
    attachmentId?: string | string[];
  },
  query: RepositoryQuery,
) {
  const context = await taskAttachmentContext(
    demandId,
    taskId,
    query,
    input.attachmentId,
  );
  if (!context.tag)
    throw referenceError(
      422,
      "TASK_CODE_REQUIRED",
      "A task must have a code to associate files",
    );
  let result;
  if (operation === "upload")
    result = await uploadAttachments(
      "requests",
      context.request.id,
      input.files || [],
      query,
      [...new Set([...parseUploadTags(input.tags), context.tag])],
    );
  else if (operation === "tags")
    result = await updateAttachmentTags(
      "requests",
      context.request.id,
      input.attachmentId || "",
      [...new Set([...parseUploadTags(input.tags), context.tag])],
      query,
    );
  else
    result = await deleteAttachment(
      "requests",
      context.request.id,
      input.attachmentId || "",
      query,
    );
  return { ...result, request: context.request, taskId: context.task.id };
}
