import { createCatalogError } from "../shared/topology/errors.js";
import { getTopologyCollections } from "../shared/topology/storage.js";
import type { ComponentFields } from "../../types/topology.js";

export async function validateRelationships(
  application: { id: string; workspaceId: string },
  component: Pick<ComponentFields, "repositoryLinks" | "dependencies"> & {
    id?: string;
  },
) {
  const { components, repositories } = await getTopologyCollections();
  const repositoryIds = component.repositoryLinks.map(
    ({ repositoryId }) => repositoryId,
  );
  const dependencyIds = component.dependencies.map(
    ({ componentId }) => componentId,
  );
  if (component.id && dependencyIds.includes(component.id)) {
    throw createCatalogError(
      422,
      "COMPONENT_SELF_DEPENDENCY",
      "a component cannot depend on itself",
    );
  }

  const [repositoryCount, dependencyCount] = await Promise.all([
    repositoryIds.length
      ? repositories.countDocuments({
          id: { $in: repositoryIds },
          workspaceId: application.workspaceId,
          applicationId: application.id,
          status: "active",
        })
      : 0,
    dependencyIds.length
      ? components.countDocuments({
          id: { $in: dependencyIds },
          workspaceId: application.workspaceId,
          applicationId: application.id,
          status: "active",
        })
      : 0,
  ]);
  if (repositoryCount !== repositoryIds.length) {
    throw createCatalogError(
      422,
      "INVALID_COMPONENT_REPOSITORY",
      "all linked repositories must be active and belong to the application",
    );
  }
  if (dependencyCount !== dependencyIds.length) {
    throw createCatalogError(
      422,
      "INVALID_COMPONENT_DEPENDENCY",
      "all dependencies must be active components of the application",
    );
  }
}
