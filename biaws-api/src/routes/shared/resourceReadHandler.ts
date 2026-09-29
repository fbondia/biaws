import type { Request, Response } from "express";
import type { RepositoryQuery } from "../../types/http.js";
import { isRecord } from "../../helpers/records.js";
import { authorizationQuery } from "../../auth/authorizationMiddleware.js";
import { createReferenceHandler } from "./asyncHandler.js";

export function createResourceReadHandler(
  type: string,
  permission: string,
  read: (req: Request, query: RepositoryQuery) => Promise<object>,
) {
  return createReferenceHandler(type)(async (req: Request, res: Response) => {
    const query = authorizationQuery(req.actor, permission, req.query);
    const result = await read(req, query);
    const fields = isRecord(result) ? result : {};
    if (fields.binary) {
      res.set({
        "Content-Type": String(
          fields.contentType || "application/octet-stream",
        ),
        "X-Content-Type-Options": "nosniff",
      });
      res.send(fields.content);
    } else if (fields.markdown !== undefined)
      res.type("text/markdown").send(fields.markdown);
    else res.json(result);
  });
}
