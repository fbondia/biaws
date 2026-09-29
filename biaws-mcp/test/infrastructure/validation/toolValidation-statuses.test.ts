import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool, listTools } from "../../../src/mcp/tools/tools.js";
import { errorInfo, fieldErrors, required } from "../../helpers/types.js";
import { VALID_TASK_STATUSES } from "./toolValidation.fixtures.js";
test("task status update declares and validates every accepted status", async () => {
  const tool = required(listTools().find(({ name }) => name === "demands_update_task_status"));

  assert.deepEqual(tool.inputSchema.properties.status.enum, VALID_TASK_STATUSES);
  assert.match(tool.description, /Requer um status válido/u);

  await assert.rejects(
    () =>
      dispatchTool("demands_update_task_status", {
        requestId: "BIAWS-1",
        taskId: "task-1",
        status: "Em andamento",
      }),
    (error) => {
      assert.equal(errorInfo(error).code, "VALIDATION_ERROR");
      assert.equal(errorInfo(error).statusCode, 400);
      assert.deepEqual(fieldErrors(error), [
        {
          path: "status",
          code: "invalid_enum",
          message: `status must be one of ${VALID_TASK_STATUSES.join(", ")}`,
        },
      ]);
      return true;
    },
  );
});
