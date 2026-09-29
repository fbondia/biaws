import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";

import { createApiRateLimitMiddleware } from "../../src/rateLimit/apiRateLimitMiddleware.js";

function responseRecorder() {
  return {
    headers: {} as Record<string, string>,
    statusCode: 200,
    payload: null as { error?: { code?: string } } | null,
    set(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(value: number) {
      this.statusCode = value;
      return this;
    },
    json(value: { error?: { code?: string } }) {
      this.payload = value;
      return this;
    },
  };
}

test("rate limiter identifies API key actors and exposes quota headers", async () => {
  const response = responseRecorder();
  let consumed: { key: string; windowSeconds: number } | undefined;
  let nextCalled = false;
  const middleware = createApiRateLimitMiddleware(
    { enabled: true, windowSeconds: 60, maxRequests: 3 },
    {
      consume: async (input) => {
        consumed = input;
        return { count: 2, expiresAt: new Date(Date.now() + 30_000) };
      },
    },
  );

  await middleware(
    {
      actor: {
        authenticationMethod: "api-key",
        apiKeyId: "key-1",
        userId: "user-1",
      },
    } as unknown as Request,
    response as unknown as Response,
    () => {
      nextCalled = true;
    },
  );

  assert.deepEqual(consumed, { key: "api-key:key-1", windowSeconds: 60 });
  assert.equal(nextCalled, true);
  assert.equal(response.headers["RateLimit-Limit"], "3");
  assert.equal(response.headers["RateLimit-Remaining"], "1");
});

test("rate limiter returns 429 after the configured maximum", async () => {
  const response = responseRecorder();
  const middleware = createApiRateLimitMiddleware(
    { enabled: true, windowSeconds: 60, maxRequests: 3 },
    {
      consume: async () => ({
        count: 4,
        expiresAt: new Date(Date.now() + 20_000),
      }),
    },
  );

  await middleware(
    {
      actor: { authenticationMethod: "session", userId: "user-1" },
    } as unknown as Request,
    response as unknown as Response,
    () => assert.fail("must not call next"),
  );

  assert.equal(response.statusCode, 429);
  assert.ok(response.payload);
  assert.ok(response.payload.error);
  assert.equal(response.payload.error.code, "RATE_LIMIT_EXCEEDED");
  assert.equal(response.headers["RateLimit-Remaining"], "0");
  assert.ok(Number(response.headers["Retry-After"]) > 0);
});

test("disabled rate limiter does not consume a bucket", async () => {
  let nextCalled = false;
  const middleware = createApiRateLimitMiddleware(
    { enabled: false, windowSeconds: 60, maxRequests: 3 },
    { consume: () => assert.fail("must not consume") },
  );

  await middleware(
    {} as Request,
    responseRecorder() as unknown as Response,
    () => {
      nextCalled = true;
    },
  );
  assert.equal(nextCalled, true);
});
