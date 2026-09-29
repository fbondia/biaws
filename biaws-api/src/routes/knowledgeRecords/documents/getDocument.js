import {
  authorize,
  currentDocument,
  sendNotFound,
  asyncHandler,
} from "../helpers.js";

export function registerGetDocument(router) {
  router.get(
    "/documents/:id",
    authorize("read"),
    asyncHandler(async (req, res) => {
      const document = await currentDocument(req);
      if (!document) return sendNotFound(res);
      res.json({ meta: { collection: "documents" }, document });
    }),
  );
}
