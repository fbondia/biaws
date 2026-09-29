import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import { getTopologyCollections } from "../../shared/topology/storage.js";
import type { RuntimeFields } from "../../../types/topology.js";

export async function validateRuntimeServer(
  deployment: { workspaceId: string; applicationId: string },
  runtime: Pick<RuntimeFields, "serverId">,
) {
  if (!runtime.serverId) return;
  const { servers } = await getTopologyCollections();
  const server = await servers.findOne({
    id: runtime.serverId,
    workspaceId: deployment.workspaceId,
    status: { $ne: "archived" },
  });
  if (!server) {
    throw createCatalogError(
      422,
      "INVALID_RUNTIME_SERVER",
      "server must be non-archived and belong to the deployment workspace",
    );
  }
}

export async function validateRuntimeDocuments(
  deployment: { workspaceId: string; applicationId: string },
  runtime: Pick<RuntimeFields, "documentLinks">,
) {
  if (!runtime.documentLinks.length) return;
  const { db } = await getTopologyCollections();
  const documentIds = runtime.documentLinks.map(({ documentId }) => documentId);
  const matched = await db
    .collection(COLLECTION_NAMES.DOCUMENTS)
    .countDocuments({
      id: { $in: documentIds },
      workspaceId: deployment.workspaceId,
      applicationId: { $in: [deployment.applicationId, null] },
      status: { $ne: "archived" },
    });
  if (matched !== documentIds.length) {
    throw createCatalogError(
      422,
      "INVALID_RUNTIME_DOCUMENTS",
      "documents must be active and belong to the runtime application or workspace",
    );
  }
}
