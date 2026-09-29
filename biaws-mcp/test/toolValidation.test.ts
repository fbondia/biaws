import assert from "node:assert/strict";
import test from "node:test";
import { errorInfo, fieldErrors, required } from "./helpers/types.js";

import { dispatchTool, listTools } from "../src/tools.js";

const VALID_TASK_STATUSES = [
  "Pendente",
  "Andamento",
  "Aguardando Decisão",
  "Concluído",
];

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

test("task status update declares and validates every accepted status", async () => {
  const tool = required(
    listTools().find(({ name }) => name === "demands_update_task_status"),
  );

  assert.deepEqual(
    tool.inputSchema.properties.status.enum,
    VALID_TASK_STATUSES,
  );
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
