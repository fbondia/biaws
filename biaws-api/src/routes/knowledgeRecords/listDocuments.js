import { listDocuments } from "../../repositories/documents/index.js";
import { authorize, query, typeFor, asyncHandler } from "./helpers.js";

export function registerListDocuments(router) {
  router.get(
    "/documents",
    authorize("read"),
    asyncHandler(async (req, res) => {
      const documentType = typeFor(req);
      res.json(
        await listDocuments(
          query(req, "read", documentType ? { documentType } : {}),
        ),
      );
    }),
  );
}
