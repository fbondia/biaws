import { randomUUID } from "crypto";
import multer from "multer";

import { serializeError } from "./logger.js";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;

function requestIdFrom(req) {
  const candidate = String(req.get("x-request-id") || "").trim();
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

function routeGroup(pathname) {
  const segments = String(pathname || "")
    .split("/")
    .filter(Boolean);
  return segments.slice(0, 2).join("/") || "root";
}

function actorContext(actor) {
  if (!actor) return {};
  return {
    actorId: actor.userId,
    authenticationMethod: actor.authenticationMethod,
    workspaceId: actor.workspaceId,
  };
}

export function createRequestLoggingMiddleware(
  logger,
  { includeHealthChecks = false } = {},
) {
  return function requestLogging(req, res, next) {
    const startedAt = process.hrtime.bigint();
    const requestId = requestIdFrom(req);
    const shouldLog = includeHealthChecks || req.path !== "/api/health";

    req.requestId = requestId;
    req.log = logger;
    res.setHeader("X-Request-Id", requestId);

    res.on("finish", () => {
      if (!shouldLog) return;

      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const fields = {
        requestId,
        method: req.method,
        path: req.path,
        routeGroup: routeGroup(req.path),
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        responseBytes: Number(res.getHeader("content-length")) || undefined,
        ...actorContext(req.actor),
      };

      if (res.statusCode >= 500) {
        logger.error("http_request_completed", fields);
      } else if (res.statusCode >= 400) {
        logger.warn("http_request_completed", fields);
      } else {
        logger.info("http_request_completed", fields);
      }
    });

    next();
  };
}

function resolveStatus(error) {
  if (error instanceof multer.MulterError) return 413;
  const candidate = Number(error?.statusCode ?? error?.status);
  return Number.isInteger(candidate) && candidate >= 400 && candidate < 600
    ? candidate
    : 500;
}

function publicError(error, statusCode, requestId) {
  if (statusCode >= 500) {
    return {
      code: "INTERNAL_ERROR",
      message: "An unexpected internal error occurred",
      requestId,
    };
  }

  const result = {
    code: error?.code || (statusCode === 404 ? "NOT_FOUND" : "BAD_REQUEST"),
    message: error?.message || "The request could not be processed",
    requestId,
  };

  if (Array.isArray(error?.requiredPermissions)) {
    result.requiredPermissions = error.requiredPermissions.map(String);
  }
  if (Array.isArray(error?.fields)) {
    result.fields = error.fields.map(({ path, code, message }) => ({
      path: String(path || ""),
      code: String(code || "invalid"),
      message: String(message || "Invalid value"),
    }));
  }
  if (
    error?.details &&
    typeof error.details === "object" &&
    !Array.isArray(error.details)
  ) {
    result.details = error.details;
  }
  if (typeof error?.retryable === "boolean") {
    result.retryable = error.retryable;
  }

  return result;
}

export function createErrorHandler(logger) {
  return function errorHandler(error, req, res, next) {
    const statusCode = resolveStatus(error);
    const fields = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode,
      ...actorContext(req.actor),
      error: serializeError(error),
    };

    if (statusCode >= 500) {
      logger.error("http_request_failed", fields);
    } else {
      logger.warn("http_request_rejected", fields);
    }

    if (res.headersSent) {
      next(error);
      return;
    }

    res.status(statusCode).json({
      error: publicError(error, statusCode, req.requestId),
    });
  };
}
