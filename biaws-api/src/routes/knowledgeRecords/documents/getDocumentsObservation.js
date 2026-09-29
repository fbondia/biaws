import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readDocumentResource } from "../../../repositories/documents/index.js";

export function registerGetDocumentsObservation(router) {
  router.get(
    "/documents/:id/observations/:observationId",
    requireAllPermissions("documents.read"),
    createResourceReadHandler(
      "document",
      "documents.read",
      async (req, query) => {
        const result = await readDocumentResource(
          req.params.id,
          "observation",
          req.params,
          query,
        );
        return result;
      },
    ),
  );
}
