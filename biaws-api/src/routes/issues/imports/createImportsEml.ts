import type { Router, Request, Response } from "express";
import { importEmlBuffer } from "../../../services/emlImportService.js";
import {
  authorizationQuery,
  requireAllPermissions,
  requireBodyFieldPermissions,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import {
  uploadEml,
  parseAffectedComponentIds,
  parseSanitizationConfig,
  parseClassification,
  requireEmlClassificationAccess,
  asyncHandler,
} from "../helpers.js";

export function registerCreateImportsEml(router: Router) {
  router.post(
    "/imports/eml",
    requireAllPermissions("issues.import.eml"),
    uploadEml.single("file"),
    requireBodyFieldPermissions({ classification: "issues.classification.update" }, null),
    requireEmlClassificationAccess,
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.file) {
        const error = new Error("Invalid EML import: multipart field 'file' is required");
        error.statusCode = 422;
        throw error;
      }

      const dryRun = ["1", "true", "yes"].includes(
        String(req.query.dryRun ?? req.body.dryRun ?? "")
          .trim()
          .toLowerCase(),
      );
      const result = await importEmlBuffer(req.file.buffer, {
        dryRun,
        explicitId: req.body.id,
        filename: req.file.originalname,
        title: req.body.title,
        type: req.body.type,
        workspaceId: req.body.workspaceId,
        applicationId: req.body.applicationId,
        affectedComponentIds: parseAffectedComponentIds(req.body.affectedComponentIds),
        classification: parseClassification(req.body.classification),
        sanitizationConfig: dryRun ? parseSanitizationConfig(req.body.sanitizationConfig) : undefined,
        actor: req.actor.email || req.actor.userId,
        authorizationScope: authorizationQuery(req.actor, "issues.import.eml").authorizationScope,
      });
      if (!dryRun) {
        await recordAuditEvent({
          actor: req.actor,
          action: result.createdIssue ? "created" : "imported",
          target: {
            type: "issue",
            id: result.issueId,
            label: result.issue?.title,
          },
          after: result.issue,
          summary: result.createdIssue ? "Issue criada por importação EML" : "EML incorporado à issue",
          metadata: {
            ...knowledgeContextMetadata(result.issue),
            insertedComments: result.insertedComments,
            storedAttachments: result.storedAttachments,
            filename: req.file.originalname,
          },
        });
      }
      res.status(!dryRun && result.createdIssue ? 201 : 200).json(result);
    }),
  );
}
