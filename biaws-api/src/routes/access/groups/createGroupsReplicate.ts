import type { Router, Request, Response } from "express";
import {
  getPermissionGroup,
  replicatePermissionGroup,
} from "../../../repositories/access/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  replicateAcrossWorkspaces,
  sendReplicationResponse,
} from "../../../services/workspaceReplicationService.js";
import { requireReplicationIdentifier } from "../../../helpers/resourceIdentifier.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerCreateGroupsReplicate(router: Router) {
  router.post(
    "/groups/:groupId/replicate",
    requireAllPermissions("roles.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const source = await getPermissionGroup(req.params.groupId, {
        workspaceId: req.actor.workspaceId ?? undefined,
      });
      if (!source) {
        res.status(404).json({
          error: {
            code: "GROUP_NOT_FOUND",
            message: `Group not found: ${req.params.groupId}`,
          },
        });
        return;
      }
      if (!source.system) {
        requireReplicationIdentifier(source, "grupo personalizado");
      }
      const batch = await replicateAcrossWorkspaces({
        actor: req.actor,
        forbiddenCode: "DESTINATION_GROUP_MANAGE_FORBIDDEN",
        forbiddenMessage:
          "Você não possui permissão para administrar grupos neste workspace",
        payload: req.body,
        permission: "roles.manage",
        resourceType: "permission_group",
        replicate: async ({ destinationActor, destinationWorkspaceId }) => {
          const result = await replicatePermissionGroup(source, {
            ...destinationActor,
            userId: destinationActor.userId || req.actor.userId,
          });
          await recordAuditEvent({
            actor: destinationActor,
            action: result.status === "replaced" ? "updated" : "created",
            target: {
              type: "permission_group",
              id: result.group.id,
              label: result.group.name,
            },
            before: result.before,
            after: result.group,
            summary: `Grupo replicado de ${source.workspaceId}: ${source.name}`,
            metadata: {
              workspaceId: destinationWorkspaceId,
              sourceGroupId: source.id,
              sourceWorkspaceId: source.workspaceId,
            },
          });
          return {
            data: { group: result.group },
            resource: {
              id: result.group.id,
              label: result.group.name,
              type: "permission_group",
            },
            status: result.status,
          };
        },
      });
      sendReplicationResponse(res, batch);
    }),
  );
}
