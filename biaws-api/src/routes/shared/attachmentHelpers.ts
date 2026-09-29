import type { Request } from "express";
import multer from "multer";
import { getServerConfig } from "../../config.js";
import { createReferenceHandler } from "./asyncHandler.js";

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: getServerConfig().maxAttachmentBytes,
    files: 10,
  },
});

export const asyncHandler = createReferenceHandler(
  (req: Request) =>
    ({
      "/api/issues": "issue",
      "/api/requests": "demand",
      "/api/knowledge": "document",
    })[req.baseUrl],
);

export function rootDocument(result: Record<string, unknown> | null | undefined, entityType: string) {
  let key;
  if (entityType === "requests") {
    key = "request";
  } else if (entityType === "issues") {
    key = "issue";
  } else {
    key = "document";
  }

  return result?.[key];
}
