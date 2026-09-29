import { createCatalogError } from "../shared/topology/errors.js";
import { getTopologyCollections } from "../shared/topology/storage.js";

export async function validateDeploymentRelationships(application, deployment) {
  const { components, repositories } = await getTopologyCollections();
  const publicationRepositoryIds = [
    ...new Set(
      (deployment.publications || [])
        .map(({ repositoryId }) => repositoryId)
        .filter(Boolean),
    ),
  ];
  const [component, repository, publicationRepositoryCount] = await Promise.all(
    [
      components.findOne({
        id: deployment.componentId,
        workspaceId: application.workspaceId,
        applicationId: application.id,
        status: "active",
      }),
      deployment.repositoryId
        ? repositories.findOne({
            id: deployment.repositoryId,
            workspaceId: application.workspaceId,
            applicationId: application.id,
            status: "active",
          })
        : null,
      publicationRepositoryIds.length
        ? repositories.countDocuments({
            id: { $in: publicationRepositoryIds },
            workspaceId: application.workspaceId,
            applicationId: application.id,
          })
        : 0,
    ],
  );
  if (!component) {
    throw createCatalogError(
      422,
      "INVALID_DEPLOYMENT_COMPONENT",
      "component must be active and belong to the application",
    );
  }
  if (deployment.repositoryId && !repository) {
    throw createCatalogError(
      422,
      "INVALID_DEPLOYMENT_REPOSITORY",
      "source repository must be active and belong to the application",
    );
  }
  if (publicationRepositoryCount !== publicationRepositoryIds.length) {
    throw createCatalogError(
      422,
      "INVALID_DEPLOYMENT_PUBLICATION_REPOSITORY",
      "publication repositories must belong to the deployment application",
    );
  }
}
