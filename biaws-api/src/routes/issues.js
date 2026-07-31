import { Router } from "express";
import multer from "multer";

import { getServerConfig } from "../config.js";
import { readAggregateGroup } from "../helpers/query.js";
import {
  aggregateIssues,
  createIssueComment,
  createIssue,
  getIssue,
  listIssuesByTaxonomy,
  listIssues,
  saveIssueClassification,
  summarizeIssues,
  updateIssue,
  updateIssueComment,
} from "../repositories/issuesRepository.js";
import {
  getIssueTaxonomy,
  saveIssueTaxonomy,
} from "../repositories/taxonomyRepository.js";
import { importEmlBuffer } from "../services/emlImportService.js";
import { registerAttachmentRoutes } from "./attachmentRoutes.js";
import {
  authorizationQuery,
  requireAllPermissions,
  requireBodyFieldPermissions,
  requireWorkspaceScope,
} from "../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";
import { knowledgeContextMetadata } from "../repositories/knowledgeContextRepository.js";
import {
  getEmailSanitizationConfiguration,
  saveEmailSanitizationConfiguration,
} from "../repositories/emailSanitizationRepository.js";

export const issuesRouter = Router();
const uploadEml = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getServerConfig().maxEmlBytes, files: 1 },
});

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function parseAffectedComponentIds(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value;
  const raw = String(value);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function parseSanitizationConfig(value) {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    const error = new Error(
      "Invalid EML sanitization configuration: expected valid JSON",
    );
    error.statusCode = 422;
    throw error;
  }
}

issuesRouter.get(
  "/imports/eml/sanitization",
  requireAllPermissions("issues.import.eml"),
  asyncHandler(async (req, res) => {
    res.json(
      await getEmailSanitizationConfiguration(
        authorizationQuery(req.actor, "issues.import.eml", req.query),
      ),
    );
  }),
);

issuesRouter.put(
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

issuesRouter.get(
  "/",
  requireAllPermissions("issues.read"),
  asyncHandler(async (req, res) => {
    res.json(
      await listIssues(authorizationQuery(req.actor, "issues.read", req.query)),
    );
  }),
);

issuesRouter.post(
  "/",
  requireBodyFieldPermissions(
    { comment: "issues.comment.create" },
    "issues.create",
  ),
  asyncHandler(async (req, res) => {
    const result = await createIssue(
      { ...req.body, createdBy: req.actor.email || req.actor.userId },
      authorizationQuery(req.actor, "issues.create", req.query),
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "created",
      target: { type: "issue", id: result.issue.id, label: result.issue.title },
      after: result.issue,
      summary: "Issue criada",
      metadata: knowledgeContextMetadata(result.issue),
    });
    if (req.body.comment && result.comments?.length) {
      const comment = result.comments.at(-1);
      await recordAuditEvent({
        actor: req.actor,
        action: "comment_added",
        target: { type: "comment", id: comment._id || comment.hash },
        root: { type: "issue", id: result.issue.id },
        after: comment,
        summary: "Comentário inicial adicionado",
        metadata: knowledgeContextMetadata(result.issue),
      });
    }
    res.status(201).json(result);
  }),
);

issuesRouter.post(
  "/imports/eml",
  requireAllPermissions("issues.import.eml"),
  uploadEml.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      const error = new Error(
        "Invalid EML import: multipart field 'file' is required",
      );
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
      affectedComponentIds: parseAffectedComponentIds(
        req.body.affectedComponentIds,
      ),
      sanitizationConfig: dryRun
        ? parseSanitizationConfig(req.body.sanitizationConfig)
        : undefined,
      actor: req.actor.email || req.actor.userId,
      authorizationScope: authorizationQuery(req.actor, "issues.import.eml")
        .authorizationScope,
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
        summary: result.createdIssue
          ? "Issue criada por importação EML"
          : "EML incorporado à issue",
        metadata: {
          ...knowledgeContextMetadata(result.issue),
          insertedComments: result.insertedComments,
          storedAttachments: result.storedAttachments,
          filename: req.file.originalname,
        },
      });
    }
    res.status(dryRun ? 200 : result.createdIssue ? 201 : 200).json(result);
  }),
);

issuesRouter.get(
  "/summary",
  requireAllPermissions("issues.read"),
  asyncHandler(async (req, res) => {
    res.json(
      await summarizeIssues(
        authorizationQuery(req.actor, "issues.read", req.query),
      ),
    );
  }),
);

issuesRouter.get(
  "/aggregate",
  requireAllPermissions("issues.read"),
  asyncHandler(async (req, res) => {
    res.json(
      await aggregateIssues(
        authorizationQuery(req.actor, "issues.read", req.query),
        readAggregateGroup(req.query),
      ),
    );
  }),
);

issuesRouter.get(
  "/taxonomy",
  requireAllPermissions("taxonomy.read"),
  asyncHandler(async (req, res) => {
    const result = await getIssueTaxonomy(
      authorizationQuery(req.actor, "taxonomy.read", req.query),
    );

    if (!result.taxonomy) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: "Issue taxonomy not found",
        },
      });
      return;
    }

    res.json(result);
  }),
);

issuesRouter.put(
  "/taxonomy",
  requireAllPermissions("taxonomy.manage"),
  asyncHandler(async (req, res) => {
    const query = authorizationQuery(req.actor, "taxonomy.manage", req.query);
    const before = (await getIssueTaxonomy(query)).taxonomy;
    const result = await saveIssueTaxonomy(
      { ...req.body, updatedBy: req.actor.email || req.actor.userId },
      query,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: before ? "updated" : "created",
      target: { type: "taxonomy", id: "biaws", label: "Taxonomia de issues" },
      before,
      after: result.taxonomy,
      summary: "Taxonomia atualizada",
    });
    res.json(result);
  }),
);

registerAttachmentRoutes(issuesRouter, "issues");

issuesRouter.post(
  "/:id/comments",
  requireAllPermissions("issues.comment.create"),
  asyncHandler(async (req, res) => {
    const query = authorizationQuery(
      req.actor,
      "issues.comment.create",
      req.query,
    );
    const result = await createIssueComment(
      req.params.id,
      { ...req.body, createdBy: req.actor.email || req.actor.userId },
      query,
    );
    const comment = result.comments.find(
      (item) => String(item._id) === result.createdCommentId,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "comment_added",
      target: { type: "comment", id: comment?._id || comment?.hash },
      root: { type: "issue", id: req.params.id },
      after: comment,
      summary: "Comentário adicionado à issue",
      metadata: knowledgeContextMetadata(result.issue),
    });
    res.status(201).json(result);
  }),
);

issuesRouter.put(
  "/:id/comments/:commentId",
  requireAllPermissions("issues.comment.update"),
  asyncHandler(async (req, res) => {
    const query = authorizationQuery(
      req.actor,
      "issues.comment.update",
      req.query,
    );
    const beforeResult = await getIssue(req.params.id, query);
    const before = beforeResult.comments.find(
      (comment) => String(comment._id) === req.params.commentId,
    );
    const result = await updateIssueComment(
      req.params.id,
      req.params.commentId,
      { ...req.body, updatedBy: req.actor.email || req.actor.userId },
      query,
    );
    const after = result.comments.find(
      (comment) => String(comment._id) === req.params.commentId,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "comment_updated",
      target: { type: "comment", id: req.params.commentId },
      root: { type: "issue", id: req.params.id },
      before,
      after,
      summary: "Comentário da issue atualizado",
      metadata: knowledgeContextMetadata(result.issue),
    });
    res.json(result);
  }),
);

issuesRouter.get(
  "/by-taxonomy/:taxonomyId",
  requireAllPermissions("issues.read"),
  asyncHandler(async (req, res) => {
    res.json(
      await listIssuesByTaxonomy(
        req.params.taxonomyId,
        authorizationQuery(req.actor, "issues.read", req.query),
      ),
    );
  }),
);

issuesRouter.put(
  "/:id/classification",
  requireAllPermissions("issues.classification.update"),
  asyncHandler(async (req, res) => {
    const scopedQuery = authorizationQuery(
      req.actor,
      "issues.classification.update",
      req.query,
    );
    const before = (await getIssue(req.params.id, scopedQuery)).issue;
    const result = await saveIssueClassification(
      req.params.id,
      { ...req.body, updatedBy: req.actor.email || req.actor.userId },
      scopedQuery,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: "classification_updated",
      target: { type: "issue", id: req.params.id, label: result.issue?.title },
      before: before?.classification || null,
      after: result.issue?.classification || null,
      summary: "Classificação da issue atualizada",
      metadata: knowledgeContextMetadata(result.issue),
    });
    res.json(result);
  }),
);

issuesRouter.patch(
  "/:id",
  requireBodyFieldPermissions(
    { status: "issues.status.update", type: "issues.update" },
    "issues.update",
  ),
  asyncHandler(async (req, res) => {
    const scopePermission = Object.keys(req.body || {}).some(
      (field) => field !== "status",
    )
      ? "issues.update"
      : "issues.status.update";
    const scopedQuery = authorizationQuery(
      req.actor,
      scopePermission,
      req.query,
    );
    const before = (await getIssue(req.params.id, scopedQuery)).issue;
    const result = await updateIssue(
      req.params.id,
      { ...req.body, updatedBy: req.actor.email || req.actor.userId },
      scopedQuery,
    );
    await recordAuditEvent({
      actor: req.actor,
      action: Object.hasOwn(req.body, "status") ? "status_changed" : "updated",
      target: { type: "issue", id: req.params.id, label: result.issue?.title },
      before,
      after: result.issue,
      summary: "Issue atualizada",
      metadata: knowledgeContextMetadata(result.issue),
    });
    res.json(result);
  }),
);

issuesRouter.get(
  "/:id",
  requireAllPermissions("issues.read"),
  asyncHandler(async (req, res) => {
    const result = await getIssue(
      req.params.id,
      authorizationQuery(req.actor, "issues.read", req.query),
    );

    if (!result.issue) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `Issue not found: ${req.params.id}`,
        },
      });
      return;
    }

    res.json(result);
  }),
);
