import { Router } from "express";

import {
  authorizationQuery,
  requireAllPermissions,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import {
  getOptionList,
  listOptionLists,
  optionListReplicationPayload,
  updateOptionList,
} from "../repositories/optionListsRepository.js";
import {
  replicateAcrossWorkspaces,
  sendReplicationResponse,
} from "../services/workspaceReplicationService.js";

export const optionListsRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

optionListsRouter.get(
  "/runtime",
  asyncHandler(async (req, res) => {
    res.json(
      await listOptionLists({
        ...req.query,
        authorizationScope: {
          workspaceId: req.actor.workspaceId,
          workspace: true,
          applicationIds: [],
        },
      }),
    );
  }),
);

optionListsRouter.get(
  "/",
  requireAllPermissions("option_lists.read"),
  asyncHandler(async (req, res) => {
    res.json(
      await listOptionLists(
        authorizationQuery(req.actor, "option_lists.read", req.query),
      ),
    );
  }),
);

optionListsRouter.put(
  "/:key",
  requireAllPermissions("option_lists.manage"),
  asyncHandler(async (req, res) => {
    const query = authorizationQuery(
      req.actor,
      "option_lists.manage",
      req.query,
    );
    const before = await getOptionList(req.params.key, query);
    if (!before) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Option list not found: ${req.params.key}`,
        },
      });
      return;
    }
    const after = await updateOptionList(req.params.key, req.body, query);
    await recordAuditEvent({
      actor: req.actor,
      action: "updated",
      target: { type: "option_list", id: after.key, label: after.name },
      before,
      after,
      summary: `Lista de opções atualizada: ${after.name}`,
    });
    res.json({ optionList: after });
  }),
);

optionListsRouter.post(
  "/:key/replicate",
  requireAllPermissions("option_lists.read"),
  asyncHandler(async (req, res) => {
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
