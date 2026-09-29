import type { Router, Request, Response } from "express";
import { DOCUMENT_TYPE_CATALOG } from "../../../../shared/documentTypes.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";

export function registerListDocumentTypes(router: Router) {
  router.get("/document-types", requireAllPermissions("documents.read"), (req: Request, res: Response) => {
    res.json({ documentTypes: Object.values(DOCUMENT_TYPE_CATALOG) });
  });
}
