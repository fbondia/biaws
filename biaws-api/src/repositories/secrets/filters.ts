import type { AuthorizationScope } from "../../types/http.js";
import type { Filter } from "mongodb";
import type { SecretDocument } from "../../types/secrets.js";
export function accessFilter({
  workspaceId,
  workspace,
  applicationIds,
}: AuthorizationScope): Filter<SecretDocument> {
  const filter: Filter<SecretDocument> = { workspaceId: String(workspaceId) };
  if (workspace !== true) {
    filter.applicationId = {
      $in: [...new Set((applicationIds || []).map(String))],
    };
  }
  return filter;
}
