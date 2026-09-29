import type { Router, Request, Response } from "express";
import { listDocuments } from "../../repositories/documents/index.js";
import { authorize, query, typeFor, asyncHandler } from "./helpers.js";

export function registerListDocuments(router: Router) {
  router.get(
    "/documents",
    authorize("read"),
    asyncHandler(async (req: Request, res: Response) => {
      const documentType = typeFor(req);
      res.json(
        await listDocuments(
          query(req, "read", documentType ? { documentType } : {}),
        ),
      );
    }),
  );
}
