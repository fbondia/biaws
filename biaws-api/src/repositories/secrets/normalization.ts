import { textValue } from "../../helpers/text.js";
import type { SecretDocument, SecretVersion } from "../../types/secrets.js";
import { SECRET_ENVIRONMENTS, SECRET_IDENTIFIER_PATTERN, SECRET_TYPES } from "./constants.js";
import { normalizedName, optionalText, requiredText, secretError } from "./support.js";

export function normalizeSecretIdentifier(value: unknown) {
  const identifier = textValue(value || "")
    .trim()
    .toLowerCase();
  if (!SECRET_IDENTIFIER_PATTERN.test(identifier)) {
    throw secretError(
      422,
      "INVALID_SECRET_IDENTIFIER",
      "identifier must contain 2 to 100 lowercase letters, numbers, dots, underscores or hyphens, starting and ending with a letter or number",
    );
  }
  return identifier;
}

export function normalizeSecretPayload(
  payload: Record<string, unknown> = {},
  current: Partial<SecretDocument> | null = null,
) {
  const name = requiredText(payload.name ?? current?.name, "name", 100);
  const type = textValue(payload.type ?? current?.type ?? "generic").trim();
  const environment = textValue(payload.environment ?? current?.environment ?? "").trim();
  if (!SECRET_TYPES.has(type)) {
    throw secretError(422, "INVALID_SECRET", "type is invalid");
  }
  if (!SECRET_ENVIRONMENTS.has(environment)) {
    throw secretError(422, "INVALID_SECRET", "environment is invalid");
  }
  return {
    identifier: normalizeSecretIdentifier(payload.identifier ?? current?.identifier ?? current?.id),
    name,
    normalizedName: normalizedName(name),
    description: optionalText(payload.description ?? current?.description, "description", 500),
    type,
    environment,
  };
}

type PublicSecretInput = Omit<Partial<SecretDocument>, "versions"> &
  Pick<SecretDocument, "id" | "workspaceId" | "name" | "type" | "status" | "currentVersion"> & {
    versions?: Array<Partial<SecretVersion> & Pick<SecretVersion, "version" | "locator">>;
  };

function publicSecretValue(document: PublicSecretInput | null) {
  if (!document) return null;
  const currentVersion = currentSecretVersion(document);
  const contentKind = document.contentKind || currentVersion?.kind || "text";
  const provisioningStatus =
    document.provisioningStatus || ((document.versions?.length || 0) > 0 ? "ready" : "pending");
  return {
    id: String(document.id),
    workspaceId: String(document.workspaceId),
    applicationId: document.applicationId ? String(document.applicationId) : null,
    collectionId: document.collectionId ? String(document.collectionId) : "",
    identifier: document.identifier || String(document.id),
    name: document.name,
    description: document.description || "",
    type: document.type,
    environment: document.environment || "",
    provider: document.provider || null,
    status: document.status,
    provisioningStatus,
    currentVersion: Number(document.currentVersion) || 0,
    versionCount: document.versions?.length || 0,
    contentKind,
    file:
      contentKind === "file" && currentVersion
        ? {
            name: currentVersion?.fileName || "secret-file",
            mediaType: currentVersion?.mediaType || "application/octet-stream",
            size: Number(currentVersion?.size) || 0,
          }
        : null,
    createdAt: document.createdAt,
    createdBy: document.createdBy,
    updatedAt: document.updatedAt,
    updatedBy: document.updatedBy,
  };
}

export function currentSecretVersion(document: PublicSecretInput) {
  return document?.versions?.find(({ version }) => version === document.currentVersion);
}

export function publicSecret(
  document: NonNullable<Parameters<typeof publicSecretValue>[0]>,
): NonNullable<ReturnType<typeof publicSecretValue>>;
export function publicSecret(document: Parameters<typeof publicSecretValue>[0]): ReturnType<typeof publicSecretValue>;
export function publicSecret(document: Parameters<typeof publicSecretValue>[0]) {
  return publicSecretValue(document);
}
