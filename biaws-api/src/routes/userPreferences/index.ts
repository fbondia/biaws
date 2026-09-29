import { Router } from "express";
import { registerGetCollectionNavigation } from "./collection-navigation/getCollectionNavigation.js";
import { registerUpdateCollectionNavigation } from "./collection-navigation/updateCollectionNavigation.js";
import { registerListMonitoringPanel } from "./listMonitoringPanel.js";
import { registerReplaceMonitoringPanel } from "./replaceMonitoringPanel.js";

export const userPreferencesRouter = Router();
registerGetCollectionNavigation(userPreferencesRouter);
registerUpdateCollectionNavigation(userPreferencesRouter);
registerListMonitoringPanel(userPreferencesRouter);
registerReplaceMonitoringPanel(userPreferencesRouter);
