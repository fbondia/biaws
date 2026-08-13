import { Router } from "express";

import {
  getCollectionNavigationPreference,
  getMonitoringPanelPreference,
  updateCollectionNavigationPreference,
  updateMonitoringPanelPreference,
} from "../repositories/userPreferencesRepository.js";

export const userPreferencesRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

userPreferencesRouter.get(
  "/collection-navigation/:context",
  asyncHandler(async (req, res) => {
    res.json(
      await getCollectionNavigationPreference(req.params.context, req.actor),
    );
  }),
);

userPreferencesRouter.patch(
  "/collection-navigation/:context",
  asyncHandler(async (req, res) => {
    res.json(
      await updateCollectionNavigationPreference(
        req.params.context,
        req.body,
        req.actor,
      ),
    );
  }),
);

userPreferencesRouter.get(
  "/monitoring-panel",
  asyncHandler(async (req, res) => {
    res.json(await getMonitoringPanelPreference(req.actor));
  }),
);

userPreferencesRouter.put(
  "/monitoring-panel",
  asyncHandler(async (req, res) => {
    res.json(await updateMonitoringPanelPreference(req.body, req.actor));
  }),
);
