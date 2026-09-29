import { textValue } from "../../helpers/text.js";
import type { RepositoryQuery } from "../../types/http.js";
import type { ComponentDocument } from "../../types/topology.js";
import type { Filter } from "mongodb";
import { COMPONENT_STATUSES, COMPONENT_TYPES } from "../../../../shared/index.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { buildScopedListFilter, pagination } from "../shared/topology/filters.js";
import { getTopologyCollections } from "../shared/topology/storage.js";
import { normalizeDocument, normalizeEnum } from "../shared/topology/normalization.js";
import { requireOperationalApplication } from "../shared/topology/context.js";

export async function listComponents(applicationId: string | string[], query: RepositoryQuery = {}) {
  const application = await requireOperationalApplication(applicationId);
  const { components } = await getTopologyCollections();
  const filter = buildScopedListFilter({
    workspaceId: application.workspaceId,
    applicationId: application.id,
    statuses: COMPONENT_STATUSES,
    query,
  });
  if (query.type) filter.type = normalizeEnum(query.type, "type", COMPONENT_TYPES);
  if (query.repositoryId) {
    filter["repositoryLinks.repositoryId"] = textValue(query.repositoryId);
  }
  if (query.dependencyComponentId) {
    filter["dependencies.componentId"] = textValue(query.dependencyComponentId);
  }
  const { page, limit, skip } = pagination(query);
  const [documents, total] = await Promise.all([
    components.find(filter).sort({ name: 1, id: 1 }).skip(skip).limit(limit).toArray(),
    components.countDocuments(filter),
  ]);
  return {
    meta: {
      collection: COLLECTION_NAMES.APPLICATION_COMPONENTS,
      workspaceId: application.workspaceId,
      applicationId: application.id,
      total,
      page,
      limit,
    },
    items: documents.map((document) => normalizeDocument(document) as ComponentDocument),
  };
}

export async function getComponent(
  componentId: string | string[],
  { applicationId, workspaceId }: { applicationId?: string; workspaceId?: string } = {},
) {
  const { components } = await getTopologyCollections();
  const filter: Filter<ComponentDocument> = { id: String(componentId) };
  if (applicationId) filter.applicationId = String(applicationId);
  if (workspaceId) filter.workspaceId = String(workspaceId);
  const component = normalizeDocument(await components.findOne(filter)) as ComponentDocument | null;
  if (!component) return null;
  await requireOperationalApplication(component.applicationId, {
    workspaceId: component.workspaceId,
  });
  return component;
}
