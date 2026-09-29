import type { Router, Request, Response } from "express";
import { getHomeDashboard } from "../../repositories/home/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerListHome(router: Router) {
  router.get(
    "/",
    asyncHandler(async (req: Request, res: Response) => {
      res.json(await getHomeDashboard(req.actor));
    }),
  );
}
