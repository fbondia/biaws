import { Router } from "express";

import {
  getHomeDashboard,
  saveHomeConfiguration,
} from "../repositories/homeRepository.js";

export const homeRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

homeRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getHomeDashboard(req.actor));
  }),
);

homeRouter.put(
  "/configuration",
  asyncHandler(async (req, res) => {
    await saveHomeConfiguration(req.body, req.actor);
    res.json(await getHomeDashboard(req.actor));
  }),
);
