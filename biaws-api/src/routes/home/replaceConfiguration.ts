import type { Router, Request, Response } from "express";
import {
  getHomeDashboard,
  saveHomeConfiguration,
} from "../../repositories/home/index.js";
import { asyncHandler } from "../shared/asyncHandler.js";

export function registerReplaceConfiguration(router: Router) {
  router.put(
    "/configuration",
    asyncHandler(async (req: Request, res: Response) => {
      await saveHomeConfiguration(req.body, req.actor);
      res.json(await getHomeDashboard(req.actor));
    }),
  );
}
