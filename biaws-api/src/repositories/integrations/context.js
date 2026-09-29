import { createCatalogError } from "../shared/topology/errors.js";
import { requireOperationalApplication } from "../shared/topology/context.js";

export async function validateTarget(application, targetApplicationId) {
  if (application.id === targetApplicationId) {
    throw createCatalogError(
      422,
      "INTEGRATION_SELF_REFERENCE",
      "an application cannot integrate with itself",
    );
  }
  try {
    return await requireOperationalApplication(targetApplicationId, {
      active: true,
      workspaceId: application.workspaceId,
    });
  } catch (error) {
    if (error.statusCode === 404) {
      throw createCatalogError(
        422,
        "INVALID_INTEGRATION_TARGET",
        "target application must be active and belong to the same workspace",
      );
    }
    throw error;
  }
}
