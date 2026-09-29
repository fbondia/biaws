import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readDocumentResource } from "../../../repositories/documents/index.js";

export function registerListDocumentsContent(router) {
  router.get(
    "/documents/:id/content",
    requireAllPermissions("documents.read"),
    createResourceReadHandler(
      "document",
      "documents.read",
      async (req, query) => {
        const result = await readDocumentResource(
          req.params.id,
          "content",
          req.params,
          query,
        );
        return { markdown: result.value };
      },
    ),
  );
}
