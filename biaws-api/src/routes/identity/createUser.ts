import type { Router, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../../auth/auth.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerCreateUser(router: Router) {
  router.post(
    "/users",
    requireAllPermissions("users.create"),
    asyncHandler(async (req: Request, res: Response) => {
      const auth = await getAuth();
      res.status(201).json(
        await auth.api.createUser({
          headers: fromNodeHeaders(req.headers),
          body: {
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            role: "user",
          },
        }),
      );
    }),
  );
}
