import type { Router, Request, Response } from "express";
import { authorizationQuery, requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import { getOptionList, updateOptionList } from "../../repositories/optionLists/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerReplaceOptionList(router: Router) {
  router.put(
    "/:key",
    requireAllPermissions("option_lists.manage"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = authorizationQuery(req.actor, "option_lists.manage", req.query);
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
      if (!after) throw new Error("Mutation result is unavailable");
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
}
