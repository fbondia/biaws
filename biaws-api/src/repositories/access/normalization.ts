import type { GroupDocument, GroupScope } from "../../types/catalog.js";
import type { PermissionScope } from "../../types/http.js";
import { isRecord } from "../../helpers/records.js";
import { errorMessage } from "../../helpers/error.js";
import { createHttpError, compareStrings, normalizedName } from "./support.js";
import { MAX_SCOPE_APPLICATIONS } from "./constants.js";
import {
  assertKnownPermissions,
  getPermissionScope,
} from "../../../../shared/index.js";
import { normalizeResourceIdentifier } from "../../helpers/resourceIdentifier.js";
import { WithId, Document } from "mongodb";

function normalizePermissions(permissions: unknown) {
  if (!Array.isArray(permissions)) {
    throw createHttpError(422, "INVALID_GROUP", "permissions must be an array");
  }

  const normalized = [...new Set(permissions)].sort(compareStrings);
  try {
    assertKnownPermissions(normalized);
  } catch (error) {
    throw createHttpError(422, "UNKNOWN_PERMISSION", errorMessage(error));
  }
  return normalized;
}

function normalizeGroupScope(
  input: unknown,
  permissions: string[],
  current: GroupScope | null = null,
) {
  const value = (isRecord(input) ? input : {}) as {
    type?: unknown;
    applicationIds?: unknown[];
  };
  const type = String(value?.type || current?.type || "workspace").trim();
  if (!["workspace", "applications"].includes(type)) {
    throw createHttpError(
      422,
      "INVALID_GROUP_SCOPE",
      "scope.type must be workspace or applications",
    );
  }
  const applicationIds =
    type === "applications"
      ? [
          ...new Set(
            (value?.applicationIds ?? current?.applicationIds ?? [])
              .map((id) => String(id || "").trim())
              .filter(Boolean),
          ),
        ]
      : [];
  if (type === "applications" && !applicationIds.length) {
    throw createHttpError(
      422,
      "INVALID_GROUP_SCOPE",
      "application-scoped groups require at least one application",
    );
  }
  if (applicationIds.length > MAX_SCOPE_APPLICATIONS) {
    throw createHttpError(
      422,
      "INVALID_GROUP_SCOPE",
      `scope.applicationIds must contain at most ${MAX_SCOPE_APPLICATIONS} items`,
    );
  }
  const incompatible = permissions.filter(
    (permission: string) => getPermissionScope(permission) === "workspace",
  );
  if (type === "applications" && incompatible.length) {
    throw createHttpError(
      422,
      "WORKSPACE_PERMISSION_REQUIRES_WORKSPACE_SCOPE",
      `Workspace permissions cannot be application-scoped: ${incompatible.join(", ")}`,
    );
  }
  return { type, applicationIds };
}

export function normalizeGroupInput(
  payload: Record<string, unknown> = {},
  current: GroupDocument | null = null,
) {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const description =
    typeof payload.description === "string" ? payload.description.trim() : "";

  if (!name || name.length > 100) {
    throw createHttpError(
      422,
      "INVALID_GROUP",
      "name must contain between 1 and 100 characters",
    );
  }
  if (description.length > 500) {
    throw createHttpError(
      422,
      "INVALID_GROUP",
      "description must contain at most 500 characters",
    );
  }

  const permissions = normalizePermissions(payload.permissions);
  return {
    identifier: current?.system
      ? null
      : normalizeResourceIdentifier(payload.identifier, current?.identifier),
    name,
    normalizedName: normalizedName(name),
    description,
    permissions,
    scope: normalizeGroupScope(payload.scope, permissions, current?.scope),
  };
}

export function calculateEffectivePermissions(groups: GroupDocument[] = []) {
  return [
    ...new Set(
      groups
        .filter((group) => group.active !== false)
        .flatMap((group) => group.permissions || []),
    ),
  ].sort(compareStrings);
}

function normalizeGroupValue(document: GroupDocument | null) {
  if (!document) return null;
  return {
    id: String(document._id),
    identifier: document.identifier || null,
    name: document.name,
    description: document.description || "",
    permissions: document.permissions || [],
    workspaceId: String(document.workspaceId || ""),
    scope: {
      type:
        document.scope?.type === "applications" ? "applications" : "workspace",
      applicationIds:
        document.scope?.type === "applications"
          ? [...new Set(document.scope.applicationIds || [])]
          : [],
    },
    active: document.active !== false,
    system: document.system === true,
    systemKey: document.systemKey || "",
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function calculatePermissionScopes(groups: GroupDocument[]) {
  const scopes: Record<
    string,
    { workspace: boolean; applicationIds: string[] }
  > = {};
  for (const group of groups.filter(({ active }) => active !== false)) {
    for (const permission of group.permissions || []) {
      const current = scopes[permission] || {
        workspace: false,
        applicationIds: [],
      };
      if (group.scope?.type === "workspace") {
        current.workspace = true;
        current.applicationIds = [];
      } else if (!current.workspace) {
        current.applicationIds = [
          ...new Set([
            ...current.applicationIds,
            ...(group.scope?.applicationIds || []),
          ]),
        ].sort(compareStrings);
      }
      scopes[permission] = current;
    }
  }
  return scopes;
}

export function normalizeGroup(
  document: NonNullable<Parameters<typeof normalizeGroupValue>[0]>,
): NonNullable<ReturnType<typeof normalizeGroupValue>>;
export function normalizeGroup(
  document: Parameters<typeof normalizeGroupValue>[0],
): ReturnType<typeof normalizeGroupValue>;
export function normalizeGroup(
  document: Parameters<typeof normalizeGroupValue>[0],
) {
  return normalizeGroupValue(document);
}
