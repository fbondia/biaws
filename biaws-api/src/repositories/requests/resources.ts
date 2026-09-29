import type { RepositoryQuery } from "../../types/http.js";
import { getRequest } from "./queries.js";
import { required, byId, resourceResponse, attachmentResourceResponse } from "../shared/resourceReads.js";
import { taskAttachmentContext } from "./tasks/attachments.js";
import { ParamsDictionary } from "express-serve-static-core";
import { isRecord } from "../../helpers/records.js";

export async function readRequestResource(
  id: string | string[],
  part: string,
  params: ParamsDictionary = {},
  query: RepositoryQuery = {},
) {
  let root, value;

  root = required((await getRequest(id, query)).request);
  const task = params.taskId ? byId(root.tasks, params.taskId) : null;
  switch (part) {
    case "section":
      value = byId(root.specification?.sections, params.sectionId);
      break;
    case "note":
      value = byId(root.notes, params.noteId);
      break;
    case "task":
      value = task;
      break;
    case "task-notes":
      value = required(task).notes || [];
      break;
    case "task-note":
      value = byId(required(task).notes, params.noteId);
      break;
    case "implementation-context":
      value = {
        request: root,
        specification: root.specification,
        checklist: root.checklist,
        journeys: root.journeys,
        notes: root.notes,
        tasks: root.tasks,
      };
      break;
    default:
      value = root[part as keyof typeof root] || [];
      break;
  }
  if (part === "tasks" && query.status && Array.isArray(value))
    value = value.filter((item: unknown) => isRecord(item) && item.status === query.status);

  return resourceResponse(root, value, params, query);
}

export async function readRequestAttachmentResource(
  id: string | string[],
  params: ParamsDictionary,
  query: RepositoryQuery = {},
) {
  const root = required((await getRequest(id, query)).request);
  let attachments = root.attachments || [];
  if (params.taskId) {
    const context = await taskAttachmentContext(id, params.taskId, query, params.attachmentId);
    attachments = context.attachments;
  }
  return attachmentResourceResponse(root, attachments, params, query);
}
