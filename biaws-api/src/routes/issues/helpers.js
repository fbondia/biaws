import multer from "multer";
import { getServerConfig } from "../../config.js";
import { actorCanAccessApplication } from "../../auth/authorizationMiddleware.js";
import { createReferenceHandler } from "../shared/asyncHandler.js";

export const uploadEml = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getServerConfig().maxEmlBytes, files: 1 },
});

export function parseAffectedComponentIds(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value;
  const raw = String(value);
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function parseSanitizationConfig(value) {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    const error = new Error(
      "Invalid EML sanitization configuration: expected valid JSON",
    );
    error.statusCode = 422;
    throw error;
  }
}

export function parseClassification(value) {
  if (value === undefined || value === null || value === "") return undefined;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("expected an object");
    }
    return parsed;
  } catch {
    const error = new Error(
      "Invalid EML classification: expected a valid JSON object",
    );
    error.statusCode = 422;
    throw error;
  }
}

export function requireEmlClassificationAccess(req, res, next) {
  if (
    req.body?.classification &&
    !actorCanAccessApplication(
      req.actor,
      "issues.classification.update",
      req.body.applicationId,
    )
  ) {
    res.status(404).json({
      error: {
        code: "APPLICATION_NOT_FOUND",
        message: "Application not found",
      },
    });
    return;
  }
  next();
}

export const asyncHandler = createReferenceHandler("issue");
