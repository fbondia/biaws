import type { Actor } from "../../types/http.js";
import { normalizeServerInput } from "./normalization.js";
import { getServer } from "./queries.js";
import { MUTABLE_SERVER_STATUSES } from "./constants.js";
import { randomUUID } from "node:crypto";
import { assertResourceCollection } from "../resourceCollections/queries.js";
import {
  actorId,
  archiveFields,
  createBaseDocument,
} from "../shared/topology/lifecycle.js";
import {
  createCatalogError,
  duplicateKeyError,
} from "../shared/topology/errors.js";
import { getTopologyCollections } from "../shared/topology/storage.js";
import { normalizeDocument } from "../shared/topology/normalization.js";
import { requireOperationalWorkspace } from "../shared/topology/context.js";

export async function createServer(
  workspaceId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const workspace = await requireOperationalWorkspace(workspaceId, {
    active: true,
  });
  const normalized = normalizeServerInput(payload);
  const document = {
    id: randomUUID(),
    ...createBaseDocument({
      key: normalized.key,
      workspaceId: workspace.id,
      actor,
    }),
    ...normalized,
  };
  const { servers } = await getTopologyCollections();
  try {
    await servers.insertOne(document);
  } catch (error) {
    duplicateKeyError(
      error,
      "SERVER_KEY_CONFLICT",
      "A server with this key already exists in the workspace",
    );
  }
  return normalizeDocument(document);
}

export async function updateServer(
  serverId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const current = await getServer(serverId);
  if (!current) {
    throw createCatalogError(404, "SERVER_NOT_FOUND", "Server not found");
  }
  if (current.status === "archived") {
    throw createCatalogError(409, "SERVER_ARCHIVED", "Server is archived");
  }
  await requireOperationalWorkspace(current.workspaceId, { active: true });
  const normalized = normalizeServerInput(payload, current);
  const { servers } = await getTopologyCollections();
  let result;
  try {
    result = await servers.updateOne(
      {
        id: current.id,
        workspaceId: current.workspaceId,
        status: { $ne: "archived" },
      },
      {
        $set: {
          ...normalized,
          updatedAt: new Date(),
          updatedBy: actorId(actor),
        },
      },
    );
  } catch (error) {
    duplicateKeyError(
      error,
      "SERVER_KEY_CONFLICT",
      "A server with this key already exists in the workspace",
    );
  }
  if (!result.matchedCount) {
    throw createCatalogError(
      409,
      "SERVER_CONCURRENT_UPDATE",
      "Server changed concurrently; reload and try again",
    );
  }
  return getServer(current.id);
}

export async function archiveServer(
  serverId: string | string[],
  actor: Partial<Actor> = {},
) {
  const current = await getServer(serverId);
  if (!current) {
    throw createCatalogError(404, "SERVER_NOT_FOUND", "Server not found");
  }
  if (current.status === "archived") return current;
  const { runtimes, servers } = await getTopologyCollections();
  const activeRuntimes = await runtimes.countDocuments({
    workspaceId: current.workspaceId,
    serverId: current.id,
    status: { $ne: "archived" },
  });
  if (activeRuntimes) {
    throw createCatalogError(
      409,
      "SERVER_IN_USE",
      "Archive or move runtimes before archiving the server",
    );
  }
  await servers.updateOne(
    {
      id: current.id,
      workspaceId: current.workspaceId,
      status: { $ne: "archived" },
    },
    {
      $set: {
        ...archiveFields(actor),
        archivedFromStatus: current.status,
      },
    },
  );
  return getServer(current.id);
}

export async function restoreServer(
  serverId: string | string[],
  actor: Partial<Actor> = {},
) {
  const current = await getServer(serverId);
  if (!current) {
    throw createCatalogError(404, "SERVER_NOT_FOUND", "Server not found");
  }
  if (current.status !== "archived") return current;
  await requireOperationalWorkspace(current.workspaceId, { active: true });
  const restoredStatus = MUTABLE_SERVER_STATUSES.includes(
    current.archivedFromStatus || "",
  )
    ? current.archivedFromStatus
    : "active";
  const { servers } = await getTopologyCollections();
  await servers.updateOne(
    { id: current.id, workspaceId: current.workspaceId, status: "archived" },
    {
      $set: {
        status: restoredStatus,
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
      $unset: {
        archivedAt: "",
        archivedBy: "",
        archivedFromStatus: "",
      },
    },
  );
  return getServer(current.id);
}

export async function deleteServer(serverId: string | string[]) {
  const current = await getServer(serverId);
  if (!current) {
    throw createCatalogError(404, "SERVER_NOT_FOUND", "Server not found");
  }
  if (current.status !== "archived") {
    throw createCatalogError(
      409,
      "SERVER_NOT_ARCHIVED",
      "Only archived servers can be permanently deleted",
    );
  }
  const { runtimes, servers } = await getTopologyCollections();
  const runtimeCount = await runtimes.countDocuments(
    { workspaceId: current.workspaceId, serverId: current.id },
    { limit: 1 },
  );
  if (runtimeCount) {
    throw createCatalogError(
      409,
      "SERVER_HAS_DEPENDENCIES",
      "Remova os runtimes vinculados antes de excluir o servidor",
    );
  }
  const result = await servers.deleteOne({
    id: current.id,
    workspaceId: current.workspaceId,
    status: "archived",
  });
  if (!result.deletedCount) {
    throw createCatalogError(
      409,
      "SERVER_DELETE_CONFLICT",
      "Server was not deleted",
    );
  }
  return current;
}

export async function moveServerToCollection(
  serverId: string | string[],
  collectionId: string,
  actor: Partial<Actor> = {},
) {
  const current = await getServer(serverId);
  if (!current) {
    throw createCatalogError(404, "SERVER_NOT_FOUND", "Server not found");
  }
  const normalizedCollectionId = await assertResourceCollection(
    "servers",
    collectionId,
    current.workspaceId,
  );
  const { servers } = await getTopologyCollections();
  await servers.updateOne(
    { id: current.id, workspaceId: current.workspaceId },
    {
      $set: {
        collectionId: normalizedCollectionId,
        updatedAt: new Date(),
        updatedBy: actorId(actor),
      },
    },
  );
  return getServer(current.id);
}
