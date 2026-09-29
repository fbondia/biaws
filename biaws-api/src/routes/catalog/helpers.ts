import type { Response } from "express";
import { createReferenceHandler } from "../shared/asyncHandler.js";

export function sendNotFound(res: Response, code: string, message: string) {
  res.status(404).json({ error: { code, message } });
}

export const asyncHandler = createReferenceHandler();
