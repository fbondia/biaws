import { getDeployment } from "../queries.js";
import { legacyPublications, normalizePublication } from "./normalization.js";
import { MAX_HISTORY_ITEMS } from "../constants.js";
import { validateDeploymentRelationships } from "../context.js";
import { randomUUID } from "node:crypto";
import { actorId } from "../../shared/topology/lifecycle.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import { getTopologyCollections } from "../../shared/topology/storage.js";
import { requireOperationalApplication } from "../../shared/topology/context.js";

export async function recordDeploymentPublication(
  deploymentId,
  payload = {},
  actor = {},
) {
  const current = await getDeployment(deploymentId);
  if (!current) {
    throw createCatalogError(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found",
    );
  }
  if (current.status === "archived") {
    throw createCatalogError(
      409,
      "DEPLOYMENT_ARCHIVED",
      "Deployment is archived",
    );
  }
  const storedPublications = Array.isArray(current.publications)
    ? current.publications
    : null;
  const materializesLegacyHistory =
    (!storedPublications || storedPublications.length === 0) &&
    Boolean(current.version || current.source?.revision || current.deployedAt);
  const currentPublications = materializesLegacyHistory
    ? legacyPublications({ ...current, publications: undefined })
    : storedPublications || [];
  if (currentPublications.length >= MAX_HISTORY_ITEMS) {
    throw createCatalogError(
      409,
      "DEPLOYMENT_PUBLICATION_LIMIT",
      `publications cannot contain more than ${MAX_HISTORY_ITEMS} items`,
    );
  }
  const application = await requireOperationalApplication(
    current.applicationId,
    {
      active: true,
      workspaceId: current.workspaceId,
    },
  );
  const publication = normalizePublication(
    {
      ...payload,
      repositoryId: payload.repositoryId || current.repositoryId,
    },
    currentPublications.length,
    {
      actor,
      id: randomUUID(),
      recordedAt: new Date(),
    },
  );
  await validateDeploymentRelationships(application, {
    ...current,
    publications: [...currentPublications, publication],
  });

  const canAppendToStoredHistory =
    storedPublications !== null && !materializesLegacyHistory;
  const set = {
    updatedAt: new Date(),
    updatedBy: actorId(actor),
  };
  if (publication.status === "deployed") {
    set.version = publication.version;
    set.source = {
      repositoryId: current.repositoryId || null,
      revision: publication.revision,
    };
    set.deployedAt = publication.publishedAt;
  }
  const { deployments } = await getTopologyCollections();
  const result = await deployments.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      applicationId: current.applicationId,
      status: { $ne: "archived" },
      ...(canAppendToStoredHistory
        ? { [`publications.${MAX_HISTORY_ITEMS - 1}`]: { $exists: false } }
        : storedPublications
          ? { publications: { $size: 0 } }
          : { publications: { $exists: false } }),
    },
    canAppendToStoredHistory
      ? { $push: { publications: publication }, $set: set }
      : {
          $set: {
            ...set,
            publications: [...currentPublications, publication],
          },
        },
  );
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "DEPLOYMENT_PUBLICATION_CONFLICT",
      "Deployment changed concurrently or reached the publication limit; reload and try again",
    );
  }
  return getDeployment(current.id);
}
