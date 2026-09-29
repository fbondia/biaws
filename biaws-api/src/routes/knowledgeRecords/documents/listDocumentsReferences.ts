import type { Router, Request } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readDocumentResource } from "../../../repositories/documents/index.js";

export function registerListDocumentsReferences(router: Router) {
  router.get(
    "/documents/:id/references",
    requireAllPermissions("documents.read"),
    createResourceReadHandler(
      "document",
      "documents.read",
      async (req: Request, query: {} | undefined) => {
        const result = await readDocumentResource(
          req.params.id,
          "references",
          req.params,
          query,
        );
        return result;
      },
    ),
  );
}
