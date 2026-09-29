import type { Router, Request, Response } from "express";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { getComponent } from "../../../repositories/components/index.js";
import {
  sendNotFound,
  scopedApplicationEntity,
  asyncHandler,
} from "../helpers.js";

export function registerGetComponent(router: Router) {
  router.get(
    "/components/:componentId",
    requireAllPermissions("components.read"),
    asyncHandler(async (req: Request, res: Response) => {
      const component = await scopedApplicationEntity(
        req,
        "components.read",
        getComponent,
        req.params.componentId,
      );
      if (!component) return sendNotFound(res, "component");
      res.json({ component });
    }),
  );
}
