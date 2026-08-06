import { cleanParams, fetchJson, sendJson } from "../../httpClient.js";

function requiredId(args, field) {
  const value = String(args?.[field] || "").trim();
  if (!value) throw new Error(`${field} is required`);
  return value;
}

export async function listSecretMetadata(args = {}) {
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

export async function getSecretMetadata(args = {}) {
  const secretId = requiredId(args, "secretId");
  return fetchJson(`/api/secrets/${encodeURIComponent(secretId)}`);
}

export async function registerSecretMetadata(args = {}) {
  return sendJson("/api/secrets/registrations", args, {}, "POST");
}
