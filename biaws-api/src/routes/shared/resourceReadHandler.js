import { authorizationQuery } from "../../auth/authorizationMiddleware.js";
import { createReferenceHandler } from "./asyncHandler.js";

export function createResourceReadHandler(type, permission, read) {
  return createReferenceHandler(type)(async (req, res) => {
    const query = authorizationQuery(req.actor, permission, req.query);
    const result = await read(req, query);
    if (result.binary) {
      res.set({
        "Content-Type": result.contentType,
        "X-Content-Type-Options": "nosniff",
      });
      res.send(result.content);
    } else if (result.markdown !== undefined)
      res.type("text/markdown").send(result.markdown);
    else res.json(result);
  });
}
