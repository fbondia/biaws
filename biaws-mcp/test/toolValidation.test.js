import assert from "node:assert/strict";
import test from "node:test";

import { dispatchTool } from "../src/tools.js";

test("tool argument validation exposes every actionable field error", async () => {
  await assert.rejects(
    () => dispatchTool("issues_get", { unexpected: true }),
    (error) => {
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.statusCode, 400);
      assert.equal(error.retryable, false);
      assert.deepEqual(error.fields, [
        {
          path: "issueId",
          code: "required",
          message: "issueId is required",
        },
        {
          path: "unexpected",
          code: "additional_property",
          message: "unexpected is not supported",
        },
      ]);
      return true;
    },
  );
});

test("tool argument validation preserves enum, numeric and array constraints", async () => {
  await assert.rejects(
    () =>
      dispatchTool("issues_search", {
        dateField: "unknownDate",
        page: 0,
        limit: 101,
      }),
    (error) => {
      assert.deepEqual(
        error.fields.map(({ path, code }) => ({ path, code })),
        [
          { path: "dateField", code: "invalid_enum" },
          { path: "page", code: "minimum" },
          { path: "limit", code: "maximum" },
        ],
      );
      return true;
    },
  );

  await assert.rejects(
    () =>
      dispatchTool("demands_create", {
        title: "Quality",
        description: "Quality pass",
        estimatedJourneys: -1,
        specificationSections: [],
        applicationId: "application-1",
      }),
    (error) => {
      assert.deepEqual(
        error.fields.map(({ path, code }) => ({ path, code })),
        [
          { path: "estimatedJourneys", code: "minimum" },
          { path: "specificationSections", code: "min_items" },
        ],
      );
      return true;
    },
  );
});
