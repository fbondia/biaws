import { Router } from "express";

import {
  getHomeDashboard,
  getHomeMonitoringData,
  getPendingTasksMetric,
  saveHomeConfiguration,
} from "../repositories/homeRepository.js";
import { requireAllPermissions } from "../auth/authorizationMiddleware.js";

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

homeRouter.get(
  "/monitoring",
  requireAllPermissions("runtimes.read"),
  asyncHandler(async (req, res) => {
    res.json(await getHomeMonitoringData(req.actor));
  }),
);

homeRouter.get(
  "/pending-tasks",
  requireAllPermissions("demands.read"),
  asyncHandler(async (req, res) => {
    res.json(await getPendingTasksMetric(req.actor, req.query));
  }),
);

homeRouter.put(
  "/configuration",
  asyncHandler(async (req, res) => {
    await saveHomeConfiguration(req.body, req.actor);
    res.json(await getHomeDashboard(req.actor));
  }),
);
