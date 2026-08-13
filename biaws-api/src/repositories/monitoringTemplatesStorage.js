import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { normalizeMonitoringTemplateDefinition } from "./monitoringTemplateEvaluator.js";
import {
  assertAllowedFields,
  createCatalogError,
  normalizeDocument,
  optionalText,
  requiredText,
} from "./topologyRepositorySupport.js";

let collectionPromise;

export async function templateCollection() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const database = await getMongoDatabase();
      const collection = database.collection(
        COLLECTION_NAMES.RUNTIME_MONITORING_TEMPLATES,
      );
      await Promise.all([
        collection.createIndex(
          { workspaceId: 1, id: 1, version: 1 },
          { unique: true },
        ),
        collection.createIndex({
          workspaceId: 1,
          nameKey: 1,
          versionNumber: -1,
        }),
        collection.createIndex({ workspaceId: 1, status: 1, updatedAt: -1 }),
      ]);
      return collection;
    })().catch((error) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}

export function normalizeTemplateInput(payload, current = null) {
  assertAllowedFields(
    payload,
    ["name", "description", "definition"],
    "monitoring template",
  );
  const name = requiredText(payload.name ?? current?.name, "name", 160);
  return {
    name,
    nameKey: name.toLocaleLowerCase("pt-BR"),
    description: optionalText(
      payload.description ?? current?.description,
      "description",
      2_000,
    ),
    definition: normalizeMonitoringTemplateDefinition(
      payload.definition ?? current?.definition,
    ),
  };
}

export function publicTemplate(document) {
  const value = normalizeDocument(document);
  if (!value) return null;
  const { nameKey, versionNumber, ...result } = value;
  return result;
}

export async function requireTemplate(id, version, workspaceId) {
  const collection = await templateCollection();
  const filter = {
    id: String(id),
    workspaceId: String(workspaceId),
    status: { $ne: "archived" },
  };
  if (version) filter.version = String(version);
  const template = await collection.findOne(
    filter,
    version ? {} : { sort: { versionNumber: -1 } },
  );
  if (!template) {
    throw createCatalogError(
      404,
      "MONITORING_TEMPLATE_NOT_FOUND",
      "Monitoring template not found",
    );
  }
  return normalizeDocument(template);
}
