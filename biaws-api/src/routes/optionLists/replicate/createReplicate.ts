import type { Router, Request, Response } from "express";
import {
  authorizationQuery,
  requireAllPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  getOptionList,
  optionListReplicationPayload,
  updateOptionList,
} from "../../../repositories/optionLists/index.js";
import {
  replicateAcrossWorkspaces,
  sendReplicationResponse,
} from "../../../services/workspaceReplicationService.js";
import { asyncHandler } from "../../shared/asyncHandler.js";

export function registerCreateReplicate(router: Router) {
  router.post(
    "/:key/replicate",
    requireAllPermissions("option_lists.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const sourceQuery = authorizationQuery(
        req.actor,
        "option_lists.read",
        req.query,
      );
      const source = await getOptionList(req.params.key, sourceQuery);
      if (!source) {
        res.status(404).json({
          error: {
            code: "NOT_FOUND",
            message: `Option list not found: ${req.params.key}`,
          },
        });
        return;
      }
      if (req.body.conflictPolicy !== "replace") {
        res.status(422).json({
          error: {
            code: "REPLICATION_REPLACE_CONFIRMATION_REQUIRED",
            message:
              "Confirme a substituição da configuração no workspace de destino",
          },
        });
        return;
      }
      const batch = await replicateAcrossWorkspaces({
        actor: req.actor,
        forbiddenCode: "DESTINATION_OPTION_LIST_MANAGE_FORBIDDEN",
        forbiddenMessage:
          "Você não possui permissão para administrar listas de opções neste workspace",
        payload: req.body,
        permission: "option_lists.manage",
        resourceType: "option_list",
        replicate: async ({ destinationActor, destinationWorkspaceId }) => {
          const destinationQuery = authorizationQuery(
            destinationActor,
            "option_lists.manage",
          );
          const before = await getOptionList(source.key, destinationQuery);
          const after = await updateOptionList(
            source.key,
            optionListReplicationPayload(source),
            destinationQuery,
          );
          if (!after) throw new Error("Mutation result is unavailable");
          await recordAuditEvent({
            actor: destinationActor,
            action: "updated",
            target: { type: "option_list", id: after.key, label: after.name },
            before,
            after,
            summary: `Lista de opções replicada de ${source.workspaceId}: ${source.name}`,
            metadata: {
              workspaceId: destinationWorkspaceId,
              sourceOptionListKey: source.key,
              sourceWorkspaceId: source.workspaceId,
            },
          });
          return {
            data: { optionList: after },
            resource: {
              id: after.key,
              label: after.name,
              type: "option_list",
            },
            status: "replaced",
          };
        },
      });
      sendReplicationResponse(res, batch);
    }),
  );
}
