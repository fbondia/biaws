import type {
  DeploymentState,
  DeploymentSource,
} from "../../types/topology.js";
import type { Actor } from "../../types/http.js";
import {
  normalizeAppendOnlyHistory,
  legacyPublications,
  normalizePublication,
} from "./publications/normalization.js";
import { MUTABLE_DEPLOYMENT_STATUSES } from "./constants.js";
import {
  CATALOG_LIMITS,
  DEPLOYMENT_ENVIRONMENTS,
} from "../../../../shared/index.js";
import {
  assertAllowedFields,
  normalizeDate,
  normalizeEnum,
  normalizeKey,
  optionalText,
  requiredText,
} from "../shared/topology/normalization.js";
import { createCatalogError } from "../shared/topology/errors.js";

function normalizeSource(
  value: unknown,
  current: Partial<DeploymentSource> = {},
) {
  if (value === undefined) {
    return {
      repositoryId: current.repositoryId || null,
      revision: current.revision || "",
    };
  }
  if (value === null) return { repositoryId: null, revision: "" };
  if (typeof value !== "object" || Array.isArray(value)) {
    throw createCatalogError(
      422,
      "INVALID_DEPLOYMENT_SOURCE",
      "source must be an object or null",
    );
  }
  assertAllowedFields(value, ["repositoryId", "revision"], "source");
  const repositoryId =
    value.repositoryId === null || value.repositoryId === ""
      ? null
      : optionalText(
          value.repositoryId ?? current.repositoryId,
          "source.repositoryId",
          100,
        ) || null;
  const revision = optionalText(
    value.revision ?? current.revision,
    "source.revision",
    CATALOG_LIMITS.revision,
  );
  if (revision && !repositoryId) {
    throw createCatalogError(
      422,
      "INVALID_DEPLOYMENT_SOURCE",
      "source.repositoryId is required when source.revision is provided",
    );
  }
  return { repositoryId, revision };
}

export function normalizeDeploymentInput(
  payload: Record<string, unknown> = {},
  current: DeploymentState | null = null,
  actor: Partial<Actor> = {},
) {
  assertAllowedFields(
    payload,
    [
      "key",
      "name",
      "componentId",
      "environment",
      "repositoryId",
      "publications",
      "version",
      "source",
      "status",
      "deployedAt",
    ],
    "deployment",
  );
  const componentId = requiredText(
    payload.componentId ?? current?.componentId,
    "componentId",
    100,
  );
  if (current && componentId !== current.componentId) {
    throw createCatalogError(
      409,
      "DEPLOYMENT_COMPONENT_IMMUTABLE",
      "deployment component cannot be changed",
    );
  }
  const repositoryId =
    optionalText(
      payload.repositoryId ??
        current?.repositoryId ??
        (payload.source &&
        typeof payload.source === "object" &&
        "repositoryId" in payload.source
          ? payload.source.repositoryId
          : undefined) ??
        current?.source?.repositoryId,
      "repositoryId",
      100,
    ) || null;
  const publications = normalizeAppendOnlyHistory({
    actor,
    current: legacyPublications(current),
    field: "publications",
    normalizeItem: (item, index: number, context) =>
      normalizePublication(
        { ...item, repositoryId: item.repositoryId || repositoryId },
        index,
        context,
      ),
    value: payload.publications,
  });
  const latestDeployedPublication = publications.findLast(
    (publication: { status: string }) =>
      !publication.status || publication.status === "deployed",
  );
  return {
    key: normalizeKey(payload.key, current?.key),
    name: requiredText(
      payload.name ?? current?.name,
      "name",
      CATALOG_LIMITS.name,
    ),
    componentId,
    environment: normalizeEnum(
      payload.environment,
      "environment",
      DEPLOYMENT_ENVIRONMENTS,
      current?.environment || "other",
    ),
    repositoryId,
    publications,
    version: publications.length
      ? latestDeployedPublication?.version || ""
      : optionalText(payload.version ?? current?.version, "version"),
    source: {
      repositoryId,
      revision: publications.length
        ? latestDeployedPublication?.revision || ""
        : normalizeSource(payload.source, current?.source).revision,
    },
    status: normalizeEnum(
      payload.status,
      "status",
      MUTABLE_DEPLOYMENT_STATUSES,
      current?.status || "planned",
    ),
    deployedAt: publications.length
      ? latestDeployedPublication?.publishedAt || null
      : normalizeDate(payload.deployedAt, "deployedAt", current?.deployedAt),
  };
}
