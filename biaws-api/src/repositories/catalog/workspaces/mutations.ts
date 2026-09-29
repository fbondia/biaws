import type { Actor } from "../../../types/http.js";
import { getCollections } from "../storage.js";
import {
  normalizeKey,
  requiredText,
  optionalText,
  actorId,
  createHttpError,
  normalizeDocument,
} from "../support.js";
import { getWorkspace } from "./queries.js";
import { randomUUID } from "node:crypto";
import { CATALOG_LIMITS } from "../../../../../shared/index.js";
import { errorCode } from "../../../helpers/error.js";

export async function createWorkspace(
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const { workspaces } = await getCollections();
  const key = normalizeKey(payload.key);
  const name = requiredText(payload.name, "name", CATALOG_LIMITS.name);
  const description = optionalText(
    payload.description,
    "description",
    CATALOG_LIMITS.description,
  );
  const now = new Date();
  const document = {
    id: randomUUID(),
    key,
    name,
    description,
    status: "active",
    default: false,
    settings: {},
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
  try {
    await workspaces.insertOne(document);
  } catch (error) {
    if (errorCode(error) === 11000) {
      throw createHttpError(
        409,
        "WORKSPACE_KEY_CONFLICT",
        "A workspace with this key already exists",
      );
    }
    throw error;
  }
  return normalizeDocument(document);
}

export async function updateWorkspace(
  workspaceId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const allowed = new Set(["name", "description"]);
  const unknown = Object.keys(payload).filter(
    (field: string) => !allowed.has(field),
  );
  if (unknown.length) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `Unknown workspace fields: ${unknown.join(", ")}`,
    );
  }
  const current = await getWorkspace(workspaceId);
  if (!current) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  const changes: { name?: string; description?: string | null } = {};
  if (Object.hasOwn(payload, "name")) {
    changes.name = requiredText(payload.name, "name", CATALOG_LIMITS.name);
  }
  if (Object.hasOwn(payload, "description")) {
    changes.description = optionalText(
      payload.description,
      "description",
      CATALOG_LIMITS.description,
    );
  }
  const { workspaces } = await getCollections();
  const result = await workspaces.findOneAndUpdate(
    { id: current.id },
    {
      $set: {
        ...changes,
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
    },
    { returnDocument: "after" },
  );
  return normalizeDocument(result);
}

export async function setWorkspaceStatus(
  workspaceId: string | string[],
  status: string,
  actor: Partial<Actor> = {},
) {
  if (!["active", "archived"].includes(status)) {
    throw createHttpError(
      422,
      "INVALID_WORKSPACE_STATUS",
      "Invalid workspace status",
    );
  }
  const current = await getWorkspace(workspaceId);
  if (!current) {
    throw createHttpError(404, "WORKSPACE_NOT_FOUND", "Workspace not found");
  }
  if (current.default && status === "archived") {
    throw createHttpError(
      409,
      "DEFAULT_WORKSPACE_REQUIRED",
      "The default workspace cannot be archived",
    );
  }
  const { workspaces } = await getCollections();
  const result = await workspaces.findOneAndUpdate(
    { id: current.id },
    {
      $set: {
        status,
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
    },
    { returnDocument: "after" },
  );
  return normalizeDocument(result);
}
