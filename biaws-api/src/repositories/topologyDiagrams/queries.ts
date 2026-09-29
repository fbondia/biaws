import type { RepositoryQuery } from "../../types/http.js";
import { diagramsCollection } from "./storage.js";
import { COLLECTION } from "./constants.js";
import { summary, normalizeDiagram } from "./normalization.js";
import { pagination } from "../shared/topology/filters.js";
import { requireOperationalApplication } from "../shared/topology/context.js";

export async function listTopologyDiagrams(
  applicationId: string | string[],
  query: RepositoryQuery = {},
) {
  const application = await requireOperationalApplication(applicationId);
  const collection = await diagramsCollection();
  const { page, limit, skip } = pagination(query);
  const filter = {
    workspaceId: application.workspaceId,
    applicationId: application.id,
  };
  const [documents, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ updatedAt: -1, name: 1, id: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      total,
      page,
      limit,
    },
    items: documents.map(summary),
  };
}

export async function getTopologyDiagram(
  diagramId: string | string[],
  {
    applicationId,
    workspaceId,
  }: { applicationId?: string; workspaceId?: string } = {},
) {
  const collection = await diagramsCollection();
  const filter: Record<string, string> = { id: String(diagramId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const document = await collection.findOne(filter);
  if (!document) return null;
  const diagram = normalizeDiagram(document);
  await requireOperationalApplication(diagram.applicationId, {
    workspaceId: diagram.workspaceId,
  });
  return diagram;
}
