import type { Collection, Filter } from "mongodb";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";
import { textValue } from "../../../helpers/text.js";
import type { MonitoringTemplateDocument } from "../../../types/monitoring.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import {
  assertAllowedFields,
  normalizeDocument,
  optionalText,
  requiredText,
} from "../../shared/topology/normalization.js";
import { normalizeMonitoringTemplateDefinition } from "./legacyEvaluator.js";

let collectionPromise: ReturnType<typeof initializeCollections> | undefined;

export async function ensureMonitoringTemplateIndexes(collection: Collection<MonitoringTemplateDocument>) {
  await Promise.all([
    collection.createIndex({ workspaceId: 1, id: 1, version: 1 }, { unique: true }),
    collection.createIndex({
      workspaceId: 1,
      nameKey: 1,
      versionNumber: -1,
    }),
    collection.createIndex({ workspaceId: 1, status: 1, updatedAt: -1 }),
  ]);
}

export async function templateCollection() {
  collectionPromise ??= initializeCollections().catch((error: unknown) => {
    collectionPromise = undefined;
    throw error;
  });
  return collectionPromise;
}

export function normalizeTemplateInput(payload: unknown, current: Partial<MonitoringTemplateDocument> | null = null) {
  assertAllowedFields(payload, ["name", "description", "definition"], "monitoring template");
  const name = requiredText(payload.name ?? current?.name, "name", 160);
  return {
    name,
    nameKey: name.toLocaleLowerCase("pt-BR"),
    description: optionalText(payload.description ?? current?.description, "description", 2_000),
    definition: normalizeMonitoringTemplateDefinition(payload.definition ?? current?.definition),
  };
}

export function publicTemplate(document: MonitoringTemplateDocument | Omit<MonitoringTemplateDocument, "_id">) {
  const { nameKey, versionNumber, ...result } = document as MonitoringTemplateDocument;
  return { ...result, _id: result._id?.toString() };
}

export async function requireTemplate(id: string | string[], version: unknown, workspaceId: string | null | undefined) {
  const collection = await templateCollection();
  const filter: Filter<MonitoringTemplateDocument> = {
    id: String(id),
    workspaceId: String(workspaceId),
    status: { $ne: "archived" },
  };
  if (version) filter.version = textValue(version);
  const template = await collection.findOne(filter, version ? {} : { sort: { versionNumber: -1 } });
  if (!template) {
    throw createCatalogError(404, "MONITORING_TEMPLATE_NOT_FOUND", "Monitoring template not found");
  }
  return normalizeDocument(template);
}

async function initializeCollections() {
  const database = await getMongoDatabase();
  const collection = database.collection<MonitoringTemplateDocument>(COLLECTION_NAMES.RUNTIME_MONITORING_TEMPLATES);
  await ensureMonitoringTemplateIndexes(collection);
  return collection;
}
