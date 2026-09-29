import type { Router, Request, Response } from "express";
import { listDocumentObservations } from "../../../repositories/documents/index.js";
import { authorize, query, currentDocument, sendNotFound, asyncHandler } from "../helpers.js";

export function registerListDocumentsObservations(router: Router) {
  router.get(
    "/documents/:id/observations",
    authorize("read"),
    asyncHandler(async (req: Request, res: Response) => {
      if (!(await currentDocument(req))) return sendNotFound(res);
      res.json(await listDocumentObservations(req.params.id, query(req, "read")));
    }),
  );
}
