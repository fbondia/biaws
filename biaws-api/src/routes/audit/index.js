import { Router } from "express";
import { registerGetAudit } from "./getAudit.js";

export const auditRouter = Router();
registerGetAudit(auditRouter);
