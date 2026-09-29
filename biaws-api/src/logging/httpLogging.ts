import type { Logger } from "./logger.js";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import multer from "multer";

import { serializeError } from "./logger.js";
import type { Actor } from "../types/http.js";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;

function requestIdFrom(req: Request) {
  const candidate = String(req.get("x-request-id") || "").trim();
  return REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();
}

function routeGroup(pathname: string) {
  const segments = String(pathname || "")
    .split("/")
    .filter(Boolean);
  return segments.slice(0, 2).join("/") || "root";
}

function actorContext(actor: Actor) {
  if (!actor) return {};
  return {
    actorId: actor.userId,
    authenticationMethod: actor.authenticationMethod,
    workspaceId: actor.workspaceId,
  };
}

export function createRequestLoggingMiddleware(
  logger: Logger,
  { includeHealthChecks = false } = {},
) {
  return function requestLogging(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
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

function resolveStatus(error: unknown) {
  if (error instanceof multer.MulterError) return 413;
  const details =
    error && typeof error === "object"
      ? (error as { statusCode?: unknown; status?: unknown })
      : {};
  const candidate = Number(details.statusCode ?? details.status);
  return Number.isInteger(candidate) && candidate >= 400 && candidate < 600
    ? candidate
    : 500;
}

function publicError(
  rawError: unknown,
  statusCode: number,
  requestId?: string,
) {
  const error =
    rawError && typeof rawError === "object"
      ? (rawError as Partial<Error>)
      : undefined;
  if (statusCode >= 500) {
    return {
      code: "INTERNAL_ERROR",
      message: "An unexpected internal error occurred",
      requestId,
    };
  }

  const result: {
    code: string | number;
    message: string;
    requestId?: string;
    requiredPermissions?: string[];
    fields?: { path: string; code: string; message: string }[];
    details?: object;
    retryable?: boolean;
  } = {
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

export function createErrorHandler(logger: Logger) {
  return function errorHandler(
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
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
