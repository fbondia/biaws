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
  (req) =>
    ({
      "/api/issues": "issue",
      "/api/requests": "demand",
      "/api/knowledge": "document",
    })[req.baseUrl],
);

export function rootDocument(result, entityType) {
  const key =
    entityType === "requests"
      ? "request"
      : entityType === "issues"
        ? "issue"
        : "document";
  return result?.[key];
}
