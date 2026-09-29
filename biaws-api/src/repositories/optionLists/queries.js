import { getCollection } from "./storage.js";
import { OPTION_LISTS_COLLECTION, OPTION_LIST_KEYS } from "./constants.js";
import { normalizeDocument } from "./normalization.js";

export async function listOptionLists(query = {}) {
  const { db, collection, workspaceId } = await getCollection(query);
  const items = await collection
    .find({ workspaceId })
    .sort({ name: 1 })
    .toArray();
  return {
    meta: {
      database: db.databaseName,
      collection: OPTION_LISTS_COLLECTION,
      total: items.length,
    },
    items: items.map(normalizeDocument),
  };
}

export async function getOptionList(key, query = {}) {
  const { collection, workspaceId } = await getCollection(query);
  return normalizeDocument(await collection.findOne({ workspaceId, key }));
}

export async function getRequestOptionLists(query = {}) {
  const result = await listOptionLists(query);
  const byKey = Object.fromEntries(
    result.items.map((list) => [list.key, list]),
  );
  return {
    demandStatus: byKey[OPTION_LIST_KEYS.DEMAND_STATUS],
    taskStatus: byKey[OPTION_LIST_KEYS.TASK_STATUS],
    checklist: byKey[OPTION_LIST_KEYS.CHECKLIST],
    specificationSections: byKey[OPTION_LIST_KEYS.SPECIFICATION_SECTIONS],
  };
}

export async function getIssueOptionLists(query = {}) {
  const result = await listOptionLists(query);
  const byKey = Object.fromEntries(
    result.items.map((list) => [list.key, list]),
  );
  return {
    types: byKey[OPTION_LIST_KEYS.ISSUE_TYPE],
    statuses: byKey[OPTION_LIST_KEYS.ISSUE_STATUS],
  };
}
