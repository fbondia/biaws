import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { errorInfo, fieldErrors } from "../../helpers/types.js";
test("tool argument validation exposes every actionable field error", async () => {
  await assert.rejects(
    () => dispatchTool("issues_get", { unexpected: true }),
    (error) => {
      assert.equal(errorInfo(error).code, "VALIDATION_ERROR");
      assert.equal(errorInfo(error).statusCode, 400);
      assert.equal(errorInfo(error).retryable, false);
      assert.deepEqual(fieldErrors(error), [
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
