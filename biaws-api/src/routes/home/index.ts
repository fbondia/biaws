import { Router } from "express";
import { registerListHome } from "./listHome.js";
import { registerListMonitoring } from "./listMonitoring.js";
import { registerListPendingTasks } from "./listPendingTasks.js";
import { registerReplaceConfiguration } from "./replaceConfiguration.js";

export const homeRouter = Router();
registerListHome(homeRouter);
registerListMonitoring(homeRouter);
registerListPendingTasks(homeRouter);
registerReplaceConfiguration(homeRouter);
