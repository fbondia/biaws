import { getRequest } from "./queries.js";
import {
  required,
  byId,
  resourceResponse,
  attachmentResourceResponse,
} from "../shared/resourceReads.js";
import { taskAttachmentContext } from "./tasks/attachments.js";

export async function readRequestResource(id, part, params = {}, query = {}) {
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
      value = task.notes || [];
      break;
    case "task-note":
      value = byId(task.notes, params.noteId);
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
      value = root[part] || [];
      break;
  }
  if (part === "tasks" && query.status)
    value = value.filter((item) => item.status === query.status);

  return resourceResponse(root, value, params, query);
}

export async function readRequestAttachmentResource(id, params, query = {}) {
  const root = required((await getRequest(id, query)).request);
  let attachments = root.attachments || [];
  if (params.taskId) {
    const context = await taskAttachmentContext(
      id,
      params.taskId,
      query,
      params.attachmentId,
    );
    attachments = context.attachments;
  }
  return attachmentResourceResponse(root, attachments, params, query);
}
