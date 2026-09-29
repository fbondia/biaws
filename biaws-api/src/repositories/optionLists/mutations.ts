import type { RepositoryQuery } from "../../types/http.js";
import { getCollection } from "./storage.js";
import { createHttpError } from "./support.js";
import {
  normalizeOptionListPayload,
  normalizeDocument,
} from "./normalization.js";

export async function updateOptionList(
  key: string | string[],
  payload: Record<string, unknown> = {},
  query: RepositoryQuery = {},
) {
  const { collection, workspaceId } = await getCollection(query);
  const current = await collection.findOne({ workspaceId, key });
  if (!current) throw createHttpError(404, `Option list not found: ${key}`);
  const normalized = normalizeOptionListPayload({ ...payload, key }, current);
  const now = new Date();
  await collection.updateOne(
    { workspaceId, key },
    { $set: { ...normalized, updatedAt: now }, $inc: { version: 1 } },
  );
  return normalizeDocument(await collection.findOne({ workspaceId, key }));
}
