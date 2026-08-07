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
