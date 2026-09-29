import { listDocumentObservations } from "../../../repositories/documents/index.js";
import {
  authorize,
  query,
  currentDocument,
  sendNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerListDocumentsObservations(router) {
  router.get(
    "/documents/:id/observations",
    authorize("read"),
    asyncHandler(async (req, res) => {
      if (!(await currentDocument(req))) return sendNotFound(res);
      res.json(
        await listDocumentObservations(req.params.id, query(req, "read")),
      );
    }),
  );
}
