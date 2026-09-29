import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { fieldErrors } from "../../helpers/types.js";
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
        fieldErrors(error).map(({ path, code }) => ({ path, code })),
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
        fieldErrors(error).map(({ path, code }) => ({ path, code })),
        [
          { path: "estimatedJourneys", code: "minimum" },
          { path: "specificationSections", code: "min_items" },
        ],
      );
      return true;
    },
  );
});
