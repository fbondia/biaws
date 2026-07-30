import { Router } from "express";

import {
  authorizationQuery,
  requireAllPermissions,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import {
  getOptionList,
  listOptionLists,
  updateOptionList,
} from "../repositories/optionListsRepository.js";

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
