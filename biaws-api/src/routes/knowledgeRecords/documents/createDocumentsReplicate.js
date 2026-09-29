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
import {
  replicateAcrossWorkspaces,
  sendReplicationResponse,
} from "../../../services/workspaceReplicationService.js";
import { requireReplicationIdentifier } from "../../../helpers/resourceIdentifier.js";
import {
  authorize,
  actorId,
  currentDocument,
  sendNotFound,
  replicationPermissionError,
  canUpdateReplicatedDocument,
  asyncHandler,
} from "../helpers.js";

export function registerCreateDocumentsReplicate(router) {
  router.post(
    "/documents/:id/replicate",
    authorize("read"),
    asyncHandler(async (req, res) => {
      const source = await currentDocument(req);
      if (!source) return sendNotFound(res);
      requireReplicationIdentifier(source, "documento");
      const batch = await replicateAcrossWorkspaces({
        actor: req.actor,
        authorizeDestination: async ({
          destinationActor,
          destinationWorkspaceId,
        }) => {
          const current = await getDocumentByIdentifier(
            source.identifier,
            destinationWorkspaceId,
          );
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
        forbiddenMessage:
          "Você não possui permissão para criar documentos gerais neste workspace",
        payload: req.body,
        permission: "documents.create",
        resourceType: "document",
        replicate: async ({ destinationActor, destinationContext }) => {
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
