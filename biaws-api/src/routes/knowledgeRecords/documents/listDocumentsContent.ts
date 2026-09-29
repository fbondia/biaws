import type { Router, Request } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { createResourceReadHandler } from "../../shared/resourceReadHandler.js";
import { readDocumentResource } from "../../../repositories/documents/index.js";

export function registerListDocumentsContent(router: Router) {
  router.get(
    "/documents/:id/content",
    requireAllPermissions("documents.read"),
    createResourceReadHandler("document", "documents.read", async (req: Request, query: {} | undefined) => {
      const result = await readDocumentResource(req.params.id, "content", req.params, query);
      if (!("value" in result)) throw new Error("Document content response is missing a value");
      return { markdown: String(result.value) };
    }),
  );
}
