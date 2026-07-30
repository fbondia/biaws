import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuthenticationMiddleware,
  requireWorkspaceContext,
} from "../src/auth/authenticationMiddleware.js";

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.payload = value;
      return this;
    },
  };
}

test("authentication middleware rejects a request without credentials", async () => {
  const response = responseRecorder();
  let nextCalled = false;
  const requireAuthentication = createAuthenticationMiddleware(
    async () => null,
  );

  await requireAuthentication({ headers: {} }, response, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(response.statusCode, 401);
  assert.equal(response.payload.error.code, "UNAUTHENTICATED");
});

test("workspace context is required when no workspace was resolved", () => {
  const response = responseRecorder();
  requireWorkspaceContext(
    { actor: { workspaceId: null, workspaces: [{ id: "a" }, { id: "b" }] } },
    response,
    () => assert.fail("must not call next"),
  );
  assert.equal(response.statusCode, 400);
  assert.equal(response.payload.error.code, "WORKSPACE_REQUIRED");
});

test("unexpected authentication failures reach the centralized error handler", async () => {
  const expected = new Error("database unavailable");
  const requireAuthentication = createAuthenticationMiddleware(async () => {
    throw expected;
  });
  const response = responseRecorder();
  let forwarded;

  await requireAuthentication({ headers: {} }, response, (error) => {
    forwarded = error;
  });

  assert.equal(forwarded, expected);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload, null);
});
