import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  createErrorHandler,
  createRequestLoggingMiddleware,
} from "../src/logging/httpLogging.js";
import {
  createLogger,
  redactLogText,
  serializeError,
} from "../src/logging/logger.js";

function captureLogger() {
  const entries = [];
  return {
    entries,
    logger: createLogger({
      now: () => new Date("2026-07-29T12:00:00.000Z"),
      write: (level, entry) => entries.push({ level, ...entry }),
    }),
  };
}

class MockResponse extends EventEmitter {
  constructor() {
    super();
    this.headers = new Map();
    this.statusCode = 200;
    this.body = undefined;
    this.headersSent = false;
  }

  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value);
  }

  getHeader(name) {
    return this.headers.get(name.toLowerCase());
  }

  status(statusCode) {
    this.statusCode = statusCode;
    return this;
  }

  json(body) {
    this.body = body;
    this.headersSent = true;
    this.emit("finish");
    return this;
  }
}

function createRequest(
  logger,
  { path = "/ok", headers = {}, includeHealthChecks = false } = {},
) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const req = {
    method: "GET",
    path,
    originalUrl: `${path}?token=secret-query-value`,
    headers: normalizedHeaders,
    get(name) {
      return normalizedHeaders[name.toLowerCase()];
    },
  };
  const res = new MockResponse();
  createRequestLoggingMiddleware(logger, { includeHealthChecks })(
    req,
    res,
    () => {},
  );
  return { req, res };
}

function authenticate(req) {
  req.actor = {
    userId: "user-1",
    authenticationMethod: "api-key",
    workspaceId: "workspace-1",
  };
}

test("access logs describe API usage without recording secrets or query strings", () => {
  const { entries, logger } = captureLogger();
  const { req, res } = createRequest(logger, {
    headers: {
      authorization: "Bearer secret-api-key",
      "x-request-id": "caller-request-123",
    },
  });
  authenticate(req);
  res.json({ ok: true });

  assert.equal(res.statusCode, 200);
  assert.equal(res.getHeader("x-request-id"), "caller-request-123");

  const accessLog = entries.find(
    ({ event }) => event === "http_request_completed",
  );
  assert.equal(accessLog.level, "info");
  assert.equal(accessLog.path, "/ok");
  assert.equal(accessLog.routeGroup, "ok");
  assert.equal(accessLog.actorId, "user-1");
  assert.equal(accessLog.authenticationMethod, "api-key");
  assert.equal(accessLog.workspaceId, "workspace-1");
  assert.equal(accessLog.statusCode, 200);
  assert.equal(typeof accessLog.durationMs, "number");

  const serializedLogs = JSON.stringify(entries);
  assert.doesNotMatch(serializedLogs, /secret-api-key/u);
  assert.doesNotMatch(serializedLogs, /secret-query-value/u);
});

test("unexpected failures expose only a correlation id and keep details in logs", () => {
  const { entries, logger } = captureLogger();
  const { req, res } = createRequest(logger, {
    path: "/internal-error",
    headers: { "x-request-id": "internal-failure-123" },
  });
  const error = new Error(
    "MongoDB failed at mongodb://user:password@example.test",
  );
  createErrorHandler(logger)(error, req, res, () => {});

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected internal error occurred",
      requestId: "internal-failure-123",
    },
  });
  assert.doesNotMatch(JSON.stringify(res.body), /password/u);

  const failureLog = entries.find(
    ({ event }) => event === "http_request_failed",
  );
  assert.equal(failureLog.level, "error");
  assert.equal(failureLog.requestId, "internal-failure-123");
  assert.equal(
    failureLog.error.message,
    "MongoDB failed at mongodb://[REDACTED]@example.test",
  );
  assert.doesNotMatch(JSON.stringify(failureLog), /user:password/u);
  assert.match(failureLog.error.stack, /httpLogging\.test/u);
});

test("functional 4xx errors remain actionable and health checks are quiet", () => {
  const { entries, logger } = captureLogger();
  const health = createRequest(logger, { path: "/api/health" });
  health.res.json({ status: "ok" });
  assert.equal(entries.length, 0);

  const { req, res } = createRequest(logger, {
    path: "/client-error",
    headers: { "x-request-id": "client-error-123" },
  });
  const error = new Error("The supplied filter is invalid");
  error.statusCode = 422;
  error.code = "INVALID_FILTER";
  createErrorHandler(logger)(error, req, res, () => {});

  assert.equal(res.statusCode, 422);
  assert.deepEqual(res.body, {
    error: {
      code: "INVALID_FILTER",
      message: "The supplied filter is invalid",
      requestId: "client-error-123",
    },
  });
  assert.ok(
    entries.some(
      ({ level, event }) =>
        level === "warn" && event === "http_request_rejected",
    ),
  );
});

test("error serialization preserves bounded causes for server-side diagnosis", () => {
  const root = new Error("database unavailable");
  root.code = "ECONNREFUSED";
  const wrapped = new Error("repository operation failed", { cause: root });

  const serialized = serializeError(wrapped);
  assert.equal(serialized.message, "repository operation failed");
  assert.equal(serialized.cause.message, "database unavailable");
  assert.equal(serialized.cause.code, "ECONNREFUSED");
});

test("common credentials are redacted before error details reach logs", () => {
  const text = redactLogText(
    'Bearer abc.def password="hunter2" API_KEY=abc123 biaws_private-key',
  );
  assert.equal(
    text,
    'Bearer [REDACTED] password="[REDACTED]" API_KEY=[REDACTED] biaws_[REDACTED]',
  );
});
