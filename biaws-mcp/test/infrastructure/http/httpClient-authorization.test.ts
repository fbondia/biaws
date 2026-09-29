import assert from "node:assert/strict";
import test from "node:test";
import { fetchJson } from "../../../src/api/httpClient.js";
import { errorInfo, fieldErrors } from "../../helpers/types.js";
test("MCP HTTP client distinguishes forbidden responses", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { code: "FORBIDDEN", message: "Denied" } }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  try {
    await assert.rejects(
      () => fetchJson("/api/issues"),
      (error) => errorInfo(error).code === "FORBIDDEN" && errorInfo(error).statusCode === 403,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("MCP HTTP client preserves structured API errors", async () => {
  const originalFetch = globalThis.fetch;
  const cases = [
    [401, "UNAUTHENTICATED"],
    [403, "FORBIDDEN"],
    [404, "APPLICATION_NOT_FOUND"],
    [409, "APPLICATION_IN_USE"],
    [422, "INVALID_CATALOG_PAYLOAD"],
  ] as const;
  try {
    for (const [status, code] of cases) {
      globalThis.fetch = async () =>
        new Response(JSON.stringify({ error: { code, message: `Error ${status}` } }), {
          status,
          headers: { "Content-Type": "application/json" },
        });
      await assert.rejects(
        () => fetchJson("/api/catalog/applications/example"),
        (error) =>
          errorInfo(error).code === code &&
          errorInfo(error).statusCode === status &&
          errorInfo(error).message === `Error ${status}`,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("MCP HTTP client preserves validation and authorization details", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: {
          code: "VALIDATION_ERROR",
          message: "Payload is invalid",
          requestId: "request-123",
          requiredPermissions: ["issues.write"],
          fields: [
            {
              path: "applicationId",
              code: "required",
              message: "applicationId is required",
            },
          ],
          retryable: false,
        },
      }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  try {
    await assert.rejects(
      () => fetchJson("/api/issues"),
      (error) =>
        errorInfo(error).requestId === "request-123" &&
        JSON.stringify(errorInfo(error).requiredPermissions) === JSON.stringify(["issues.write"]) &&
        "issues.write" === "issues.write" &&
        fieldErrors(error)[0].path === "applicationId" &&
        errorInfo(error).retryable === false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
