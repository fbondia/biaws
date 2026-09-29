import { createReferenceHandler } from "../shared/asyncHandler.js";

export function sendNotFound(res, code, message) {
  res.status(404).json({ error: { code, message } });
}

export const asyncHandler = createReferenceHandler(undefined);
