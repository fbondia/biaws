import { CATALOG_LIMITS } from "../../../../shared/index.js";
import { assertAllowedFields, normalizeKey, optionalText, requiredText } from "../shared/topology/normalization.js";
import { createCatalogError } from "../shared/topology/errors.js";

export function normalizeIntegrationInput(
  payload: Record<string, unknown> = {},
  current: {
    key?: string;
    name?: string;
    description?: string;
    targetApplicationId?: string;
  } | null = null,
) {
  assertAllowedFields(payload, ["key", "name", "description", "targetApplicationId"], "integration");
  const targetApplicationId = requiredText(
    payload.targetApplicationId ?? current?.targetApplicationId,
    "targetApplicationId",
    100,
  );
  if (current && targetApplicationId !== current.targetApplicationId) {
    throw createCatalogError(409, "INTEGRATION_TARGET_IMMUTABLE", "integration target application cannot be changed");
  }
  return {
    key: normalizeKey(payload.key, current?.key),
    name: requiredText(payload.name ?? current?.name, "name", CATALOG_LIMITS.name),
    description: optionalText(payload.description ?? current?.description, "description", CATALOG_LIMITS.description),
    targetApplicationId,
  };
}
