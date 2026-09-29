import { createHttpError } from "../support.js";
import { getCollections } from "../storage.js";
import { normalizeGroup } from "../normalization.js";
import {
  updatePermissionGroup,
  createPermissionGroup,
  ensureWorkspacePermissionGroups,
} from "./mutations.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { requireReplicationIdentifier } from "../../../helpers/resourceIdentifier.js";

export function permissionGroupReplicationPayload(
  group = {},
  applicationIds = [],
) {
  const applicationScope = group.scope?.type === "applications";
  if (applicationScope && !applicationIds.length) {
    throw createHttpError(
      422,
      "GROUP_SCOPE_APPLICATION_MAPPING_MISSING",
      "Não foi possível mapear as aplicações do grupo no workspace de destino",
    );
  }
  return {
    ...(group.identifier ? { identifier: group.identifier } : {}),
    name: group.name,
    description: group.description || "",
    permissions: [...(group.permissions || [])],
    scope: applicationScope
      ? { type: "applications", applicationIds: [...applicationIds] }
      : { type: "workspace", applicationIds: [] },
  };
}

async function replicatedGroupApplicationIds(
  db,
  group,
  destinationWorkspaceId,
) {
  if (group.scope?.type !== "applications") return [];
  const applications = db.collection(COLLECTION_NAMES.APPLICATIONS);
  const sourceIds = [...new Set(group.scope.applicationIds || [])];
  const sourceApplications = await applications
    .find({
      id: { $in: sourceIds },
      workspaceId: group.workspaceId,
      status: "active",
    })
    .project({ _id: 0, id: 1, key: 1 })
    .toArray();
  if (sourceApplications.length !== sourceIds.length) {
    throw createHttpError(
      422,
      "INVALID_GROUP_SCOPE",
      "O grupo de origem referencia aplicações ausentes ou inativas",
    );
  }
  const keys = sourceApplications.map(({ key }) => key);
  const destinationApplications = await applications
    .find({
      key: { $in: keys },
      workspaceId: destinationWorkspaceId,
      status: "active",
    })
    .project({ _id: 0, id: 1, key: 1 })
    .toArray();
  if (destinationApplications.length !== keys.length) {
    throw createHttpError(
      422,
      "GROUP_SCOPE_APPLICATION_MAPPING_MISSING",
      "O workspace de destino não possui todas as aplicações do escopo do grupo",
    );
  }
  const destinationByKey = new Map(
    destinationApplications.map((application) => [
      application.key,
      application,
    ]),
  );
  return keys.map((key) => destinationByKey.get(key).id);
}

export async function replicatePermissionGroup(group, destinationActor) {
  const { db, groups } = await getCollections();
  const destinationWorkspaceId = String(destinationActor.workspaceId || "");
  const applicationIds = await replicatedGroupApplicationIds(
    db,
    group,
    destinationWorkspaceId,
  );
  const payload = permissionGroupReplicationPayload(group, applicationIds);
  if (!group.system) {
    requireReplicationIdentifier(group, "grupo personalizado");
    const current = normalizeGroup(
      await groups.findOne({
        workspaceId: destinationWorkspaceId,
        system: { $ne: true },
        identifier: group.identifier,
      }),
    );
    if (current) {
      return {
        before: current,
        group: await updatePermissionGroup(
          current.id,
          payload,
          destinationActor,
        ),
        status: "replaced",
      };
    }
    return {
      before: null,
      group: await createPermissionGroup(payload, destinationActor),
      status: "created",
    };
  }
  if (!group.systemKey) {
    throw createHttpError(
      422,
      "INVALID_SYSTEM_GROUP",
      "O grupo de sistema não possui uma chave de correspondência",
    );
  }
  await ensureWorkspacePermissionGroups(
    destinationWorkspaceId,
    destinationActor,
  );
  const current = normalizeGroup(
    await groups.findOne({
      workspaceId: destinationWorkspaceId,
      system: true,
      systemKey: group.systemKey,
    }),
  );
  if (!current) {
    throw createHttpError(
      404,
      "DESTINATION_SYSTEM_GROUP_NOT_FOUND",
      "O grupo de sistema correspondente não foi encontrado no destino",
    );
  }
  return {
    before: current,
    group: await updatePermissionGroup(current.id, payload, destinationActor),
    status: "replaced",
  };
}
