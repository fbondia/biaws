import type { Router, Request, Response } from "express";
import {
  actorHasPermission,
  actorHasWorkspaceScope,
  authorizationQuery,
} from "../../../auth/authorizationMiddleware.js";
import { recordAuditEvent } from "../../../repositories/audit/index.js";
import {
  createDocument,
  documentReplicationPayload,
  getDocumentByIdentifier,
  updateDocument,
} from "../../../repositories/documents/index.js";
import { knowledgeContextMetadata } from "../../../repositories/shared/knowledgeContext.js";
import { replicateAcrossWorkspaces, sendReplicationResponse } from "../../../services/workspaceReplicationService.js";
import { requireReplicationIdentifier } from "../../../helpers/resourceIdentifier.js";
import type { PublicStoredKnowledgeDocument } from "../../../types/documents.js";
import {
  authorize,
  actorId,
  currentDocument,
  sendNotFound,
  replicationPermissionError,
  canUpdateReplicatedDocument,
  asyncHandler,
} from "../helpers.js";

export function registerCreateDocumentsReplicate(router: Router) {
  router.post(
    "/documents/:id/replicate",
    authorize("read"),
    asyncHandler(async (req: Request, res: Response) => {
      const source = await currentDocument(req);
      if (!source) return sendNotFound(res);
      const identifier = requireReplicationIdentifier(source, "documento");
      const batch = await replicateAcrossWorkspaces<{
        current: PublicStoredKnowledgeDocument | null;
      }>({
        actor: req.actor,
        authorizeDestination: async ({ destinationActor, destinationWorkspaceId }) => {
          const current = await getDocumentByIdentifier(identifier, destinationWorkspaceId);
          if (current) {
            if (!canUpdateReplicatedDocument(destinationActor, current)) {
              throw replicationPermissionError(
                "documents.update",
                "Você não possui permissão para atualizar o documento correspondente neste workspace",
              );
            }
            return { current };
          }
          if (
            !actorHasPermission(destinationActor, "documents.create") ||
            !actorHasWorkspaceScope(destinationActor, "documents.create")
          ) {
            throw replicationPermissionError(
              "documents.create",
              "Você não possui permissão para criar documentos gerais neste workspace",
            );
          }
          return { current: null };
        },
        forbiddenCode: "DESTINATION_DOCUMENT_CREATE_FORBIDDEN",
        forbiddenMessage: "Você não possui permissão para criar documentos gerais neste workspace",
        payload: req.body,
        permission: "documents.create",
        resourceType: "document",
        replicate: async ({ destinationActor, destinationContext }) => {
          if (!destinationContext) throw new Error("Destination document context is unavailable");
          const before = destinationContext.current;
          const result = before
            ? await updateDocument(
                before.id,
                {
                  ...documentReplicationPayload(source),
                  changeSummary: `Conteúdo replicado de ${source.workspaceId}`,
                  updatedBy: actorId(req),
                },
                authorizationQuery(destinationActor, "documents.update"),
              )
            : await createDocument(
                {
                  ...documentReplicationPayload(source),
                  documentType: source.documentType,
                  createdBy: actorId(req),
                },
                {
                  ...authorizationQuery(destinationActor, "documents.create"),
                  allowWorkspaceContext: true,
                },
              );
          const document = result.document;
          if (!document) throw new Error("Replicated document could not be read");
          await recordAuditEvent({
            actor: destinationActor,
            action: before ? "updated" : "created",
            target: {
              type: "document",
              id: document.id,
              label: document.title,
            },
            before,
            after: document,
            summary: `Documento replicado de ${source.workspaceId}`,
            metadata: {
              ...knowledgeContextMetadata(document),
              sourceDocumentId: source.id,
              sourceWorkspaceId: source.workspaceId,
            },
          });
          return {
            data: result,
            resource: {
              id: document.id,
              label: document.title,
              type: "document",
            },
            status: before ? "replaced" : "created",
          };
        },
      });
      sendReplicationResponse(res, batch);
    }),
  );
}
