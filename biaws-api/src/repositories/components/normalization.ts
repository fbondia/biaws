import type { ComponentFields } from "../../types/topology.js";
import { CATALOG_LIMITS, COMPONENT_TYPES, REPOSITORY_LINK_ROLES } from "../../../../shared/index.js";
import {
  assertAllowedFields,
  normalizeEnum,
  normalizeKey,
  normalizeTags,
  optionalText,
  requiredText,
} from "../shared/topology/normalization.js";
import { createCatalogError } from "../shared/topology/errors.js";

function normalizeRepositoryLinks(value: unknown, current: ComponentFields["repositoryLinks"] = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > CATALOG_LIMITS.relationships) {
    throw createCatalogError(
      422,
      "INVALID_COMPONENT_RELATIONSHIP",
      `repositoryLinks must be an array with at most ${CATALOG_LIMITS.relationships} items`,
    );
  }
  const unique = new Map<string, ComponentFields["repositoryLinks"][number]>();
  value.forEach((link, index: number) => {
    if (!link || typeof link !== "object" || Array.isArray(link)) {
      throw createCatalogError(422, "INVALID_COMPONENT_RELATIONSHIP", `repositoryLinks[${index}] must be an object`);
    }
    assertAllowedFields(link, ["repositoryId", "role"], `repositoryLinks[${index}]`);
    const repositoryId = requiredText(link.repositoryId, `repositoryLinks[${index}].repositoryId`, 100);
    if (unique.has(repositoryId)) {
      throw createCatalogError(
        422,
        "INVALID_COMPONENT_RELATIONSHIP",
        `repository is linked more than once: ${repositoryId}`,
      );
    }
    unique.set(repositoryId, {
      repositoryId,
      role: normalizeEnum(link.role, `repositoryLinks[${index}].role`, REPOSITORY_LINK_ROLES, "source"),
    });
  });
  return [...unique.values()];
}

function normalizeDependencies(value: unknown, current: ComponentFields["dependencies"] = []) {
  if (value === undefined) return current;
  if (!Array.isArray(value) || value.length > CATALOG_LIMITS.relationships) {
    throw createCatalogError(
      422,
      "INVALID_COMPONENT_RELATIONSHIP",
      `dependencies must be an array with at most ${CATALOG_LIMITS.relationships} items`,
    );
  }
  const unique = new Map<string, ComponentFields["dependencies"][number]>();
  value.forEach((dependency, index: number) => {
    if (!dependency || typeof dependency !== "object" || Array.isArray(dependency)) {
      throw createCatalogError(422, "INVALID_COMPONENT_RELATIONSHIP", `dependencies[${index}] must be an object`);
    }
    assertAllowedFields(dependency, ["componentId", "kind", "description"], `dependencies[${index}]`);
    const componentId = requiredText(dependency.componentId, `dependencies[${index}].componentId`, 100);
    if (unique.has(componentId)) {
      throw createCatalogError(
        422,
        "INVALID_COMPONENT_RELATIONSHIP",
        `component is declared more than once as a dependency: ${componentId}`,
      );
    }
    unique.set(componentId, {
      componentId,
      kind: optionalText(dependency.kind, `dependencies[${index}].kind`, CATALOG_LIMITS.dependencyKind),
      description: optionalText(
        dependency.description,
        `dependencies[${index}].description`,
        CATALOG_LIMITS.description,
      ),
    });
  });
  return [...unique.values()];
}

export function normalizeComponentInput(
  payload: Record<string, unknown> = {},
  current: Partial<ComponentFields> | null = null,
) {
  assertAllowedFields(
    payload,
    ["key", "name", "description", "type", "repositoryLinks", "dependencies", "tags"],
    "component",
  );
  return {
    key: normalizeKey(payload.key, current?.key),
    name: requiredText(payload.name ?? current?.name, "name", CATALOG_LIMITS.name),
    description: optionalText(payload.description ?? current?.description, "description", CATALOG_LIMITS.description),
    type: normalizeEnum(payload.type, "type", COMPONENT_TYPES, current?.type || "other"),
    repositoryLinks: normalizeRepositoryLinks(payload.repositoryLinks, current?.repositoryLinks),
    dependencies: normalizeDependencies(payload.dependencies, current?.dependencies),
    tags: normalizeTags(payload.tags, current?.tags),
  };
}
