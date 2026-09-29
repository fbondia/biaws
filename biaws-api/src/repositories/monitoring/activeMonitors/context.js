import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";
import { getRuntime } from "../../deployments/runtimes/queries.js";
import { createCatalogError } from "../../shared/topology/errors.js";

export async function validateTemplateRef(
  templateRef,
  runtime,
  { allowInactive = false } = {},
) {
  if (!templateRef) return;
  const database = await getMongoDatabase();
  const template = await database
    .collection(COLLECTION_NAMES.RUNTIME_MONITORING_TEMPLATES)
    .findOne({
      id: templateRef.id,
      version: templateRef.version,
      workspaceId: runtime.workspaceId,
      status: allowInactive ? { $ne: "archived" } : "active",
    });
  if (!template) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_TEMPLATE",
      "template must be active, match the requested version and belong to the runtime workspace",
    );
  }
}

export async function requireRuntime(runtimeId, workspaceId) {
  const runtime = await getRuntime(runtimeId, { workspaceId });
  if (!runtime || runtime.status === "archived") {
    throw createCatalogError(404, "RUNTIME_NOT_FOUND", "Runtime not found");
  }
  return runtime;
}
