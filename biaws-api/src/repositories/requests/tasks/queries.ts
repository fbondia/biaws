import type { Db, ObjectId } from "mongodb";
import { TASKS_COLLECTION, TASK_NOTES_COLLECTION } from "../constants.js";
import { requestOptions } from "../options.js";
import { compareRequestTasks } from "../../../../../shared/requestTaskSorting.js";

export async function readTasks(db: Db, requestIds: ObjectId[]) {
  if (!requestIds.length) return new Map();

  const rows = await db
    .collection(TASKS_COLLECTION)
    .find({ requestId: { $in: requestIds } })
    .toArray();
  rows.sort((first, second) => compareRequestTasks(first, second, requestOptions.allTaskStatusOptions));
  const taskIds = rows.map((row) => row._id);
  const noteRows = taskIds.length
    ? await db
        .collection(TASK_NOTES_COLLECTION)
        .find({ taskId: { $in: taskIds } })
        .sort({ date: -1, createdAt: -1 })
        .toArray()
    : [];
  const notesByTaskId = new Map();
  for (const note of noteRows) {
    const taskKey = note.taskId?.toString?.() ?? String(note.taskId);
    const notes = notesByTaskId.get(taskKey) || [];
    notes.push(note);
    notesByTaskId.set(taskKey, notes);
  }
  const byRequestId = new Map();

  for (const row of rows) {
    const key = row.requestId?.toString?.() ?? String(row.requestId);
    const items = byRequestId.get(key) || [];
    items.push({ ...row, notes: notesByTaskId.get(row._id.toString()) || [] });
    byRequestId.set(key, items);
  }

  return byRequestId;
}
