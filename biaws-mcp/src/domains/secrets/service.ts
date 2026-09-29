import type { ServiceArguments } from "../../contracts.js";
import { BiawsError } from "../../errors.js";
import { cleanParams, fetchJson, sendJson } from "../../httpClient.js";

function requiredId(args: Record<string, unknown>, field: string) {
  const value = String(args?.[field] || "").trim();
  if (!value) throw new BiawsError(`${field} is required`);
  return value;
}

export async function listSecretMetadata(
  args: ServiceArguments<"secrets_list"> = {},
) {
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

export async function getSecretMetadata(
  args: ServiceArguments<"secrets_get"> = {},
) {
  const secretId = requiredId(args, "secretId");
  return fetchJson(`/api/secrets/${encodeURIComponent(secretId)}`);
}

export async function registerSecretMetadata(
  args: ServiceArguments<"secrets_register"> = {},
) {
  return sendJson("/api/secrets/registrations", args, {}, "POST");
}
