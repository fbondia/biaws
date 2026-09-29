import { randomUUID } from "node:crypto";
import { CATALOG_LIMITS, PUBLICATION_STATUSES } from "../../../../../shared/index.js";
import type { Actor } from "../../../types/http.js";
import type { DeploymentState, Publication } from "../../../types/topology.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import { actorId } from "../../shared/topology/lifecycle.js";
import {
  assertAllowedFields,
  normalizeDate,
  normalizeEnum,
  optionalText,
  requiredText,
} from "../../shared/topology/normalization.js";
import { MAX_HISTORY_ITEMS } from "../constants.js";

export function legacyPublications(current: DeploymentState | null): Publication[] {
  if (Array.isArray(current?.publications)) return current.publications;
  if (!current?.version && !current?.source?.revision && !current?.deployedAt) {
    return [];
  }
  return [
    {
      id: `legacy-${current.id || "publication"}`,
      version: current.version || "Versão não informada",
      revision: current.source?.revision || "",
      repositoryId: current.source?.repositoryId || null,
      status: "deployed",
      publishedAt: current.deployedAt || current.updatedAt || current.createdAt || null,
      description: "",
      recordedAt: current.updatedAt || current.createdAt,
      recordedBy: current.updatedBy || current.createdBy || "system",
    },
  ];
}

export function normalizeAppendOnlyHistory({
  actor,
  current = [],
  field,
  normalizeItem,
  value,
}: {
  actor: Partial<Actor>;
  current?: Publication[];
  field: string;
  normalizeItem: (
    item: Record<string, unknown>,
    index: number,
    context: { actor: Partial<Actor>; id: string; recordedAt: Date },
  ) => Publication;
  value: unknown;
}): Publication[] {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > MAX_HISTORY_ITEMS) {
    throw createCatalogError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `${field} must be an array with at most ${MAX_HISTORY_ITEMS} items`,
    );
  }
  if (value.length < current.length || current.some((item, index: number) => value[index]?.id !== item.id)) {
    throw createCatalogError(409, "CATALOG_HISTORY_IMMUTABLE", `${field} entries cannot be changed or removed`);
  }
  const preserved = current.map((item, index: number) => ({
    ...item,
    status: normalizeEnum(
      value[index]?.status,
      `${field}[${index}].status`,
      PUBLICATION_STATUSES,
      item.status || "deployed",
    ),
  }));
  return [
    ...preserved,
    ...value.slice(current.length).map((item, index: number) =>
      normalizeItem(item, current.length + index, {
        actor,
        id: randomUUID(),
        recordedAt: new Date(),
      }),
    ),
  ];
}

export function normalizePublication(
  item: unknown,
  index: number,
  context: { actor: Partial<Actor>; id: string; recordedAt: Date },
): Publication {
  assertAllowedFields(
    item,
    ["id", "version", "revision", "repositoryId", "status", "publishedAt", "description", "recordedAt", "recordedBy"],
    `publications[${index}]`,
  );
  return {
    id: context.id,
    version: requiredText(item.version, `publications[${index}].version`, CATALOG_LIMITS.version),
    revision: optionalText(item.revision, `publications[${index}].revision`, CATALOG_LIMITS.revision),
    repositoryId: optionalText(item.repositoryId, `publications[${index}].repositoryId`, 100) || null,
    status: normalizeEnum(item.status, `publications[${index}].status`, PUBLICATION_STATUSES, "planned"),
    publishedAt: normalizeDate(item.publishedAt, `publications[${index}].publishedAt`) || context.recordedAt,
    description: optionalText(item.description, `publications[${index}].description`, CATALOG_LIMITS.description),
    recordedAt: context.recordedAt,
    recordedBy: actorId(context.actor),
  };
}
