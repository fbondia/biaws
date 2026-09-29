import type { ServiceArguments } from "../../mcp/tools/contracts.js";
import { cleanParams, fetchJson, sendJson } from "../../api/httpClient.js";

export async function listSecretMetadata(args: ServiceArguments<"secrets_list"> = {}) {
  return fetchJson(
    "/api/secrets",
    cleanParams({
      applicationId: args.applicationId,
      environment: args.environment,
      provisioningStatus: args.provisioningStatus,
      status: args.status,
      page: args.page,
      limit: args.limit,
    }),
  );
}

export async function registerSecretMetadata(args: ServiceArguments<"secrets_register"> = {}) {
  return sendJson("/api/secrets/registrations", args, {}, "POST");
}
