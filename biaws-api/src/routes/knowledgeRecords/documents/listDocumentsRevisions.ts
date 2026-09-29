import type { Router, Request, Response } from "express";
import { listDocumentRevisions } from "../../../repositories/documents/index.js";
import {
  authorize,
  query,
  currentDocument,
  sendNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerListDocumentsRevisions(router: Router) {
  router.get(
    "/documents/:id/revisions",
    authorize("read"),
    asyncHandler(async (req: Request, res: Response) => {
      if (!(await currentDocument(req))) return sendNotFound(res);
      res.json(await listDocumentRevisions(req.params.id, query(req, "read")));
    }),
  );
}
