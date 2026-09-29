import type { Router, Request, Response } from "express";
import { authorize, currentDocument, sendNotFound, asyncHandler } from "../helpers.js";

export function registerGetDocument(router: Router) {
  router.get(
    "/documents/:id",
    authorize("read"),
    asyncHandler(async (req: Request, res: Response) => {
      const document = await currentDocument(req);
      if (!document) return sendNotFound(res);
      res.json({ meta: { collection: "documents" }, document });
    }),
  );
}
