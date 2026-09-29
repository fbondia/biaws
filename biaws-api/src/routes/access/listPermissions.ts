import type { Router, Request, Response } from "express";
import { PERMISSION_CATALOG } from "../../../../shared/index.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";

export function registerListPermissions(router: Router) {
  router.get("/permissions", requireAllPermissions("roles.read"), (req: Request, res: Response) => {
    res.json({ permissions: PERMISSION_CATALOG });
  });
}
