import {
  authorizationQuery,
  requireAllPermissions,
} from "../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";
import {
  getOptionList,
  updateOptionList,
} from "../../repositories/optionLists/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerReplaceOptionList(router) {
  router.put(
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
}
