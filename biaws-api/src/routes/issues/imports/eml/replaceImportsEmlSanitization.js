import {
  authorizationQuery,
  requireAllPermissions,
  requireWorkspaceScope,
} from "../../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../../repositories/audit/index.js";
import { saveEmailSanitizationConfiguration } from "../../../../repositories/issues/emailSanitization.js";
import { asyncHandler } from "../../helpers.js";

export function registerReplaceImportsEmlSanitization(router) {
  router.put(
    "/imports/eml/sanitization",
    requireAllPermissions("issues.import.eml"),
    requireWorkspaceScope("issues.import.eml"),
    asyncHandler(async (req, res) => {
      const result = await saveEmailSanitizationConfiguration(req.body, {
        ...authorizationQuery(req.actor, "issues.import.eml", req.query),
        actor: req.actor.email || req.actor.userId,
      });
      await recordAuditEvent({
        actor: req.actor,
        action: "updated",
        target: {
          type: "email_sanitization_configuration",
          id: result.workspaceId,
          label: "Sanitização de EML",
        },
        after: result,
        summary: "Configuração de sanitização de EML atualizada",
        metadata: { workspaceId: result.workspaceId, version: result.version },
      });
      res.json(result);
    }),
  );
}
