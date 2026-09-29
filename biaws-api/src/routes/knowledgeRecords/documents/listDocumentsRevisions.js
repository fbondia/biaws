import { listDocumentRevisions } from "../../../repositories/documents/index.js";
import {
  authorize,
  query,
  currentDocument,
  sendNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerListDocumentsRevisions(router) {
  router.get(
    "/documents/:id/revisions",
    authorize("read"),
    asyncHandler(async (req, res) => {
      if (!(await currentDocument(req))) return sendNotFound(res);
      res.json(await listDocumentRevisions(req.params.id, query(req, "read")));
    }),
  );
}
