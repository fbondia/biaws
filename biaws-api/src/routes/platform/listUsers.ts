import type { Router, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../../auth/auth.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListUsers(router: Router) {
  router.get(
    "/users",
    asyncHandler(async (req: Request, res: Response) => {
      const auth = await getAuth();
      const payload = await auth.api.listUsers({
        headers: fromNodeHeaders(req.headers),
        query: { limit: 100 },
      });
      res.json({ users: payload.users || [] });
    }),
  );
}
