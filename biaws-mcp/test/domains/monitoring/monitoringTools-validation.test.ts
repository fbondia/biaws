import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { errorInfo, fieldErrors } from "../../helpers/types.js";
test("monitoring schemas reject invalid enums, bounds and extra fields", async () => {
  for (const [name, args, path] of [
    [
      "runtime_active_monitors_create",
      {
        runtimeReference: "runtime-1",
        name: "Health",
        provider: "command",
        configuration: {},
      },
      "provider",
    ],
    [
      "runtime_active_monitors_create",
      {
        runtimeReference: "runtime-1",
        name: "Health",
        provider: "rest",
        intervalSeconds: 5,
        configuration: {},
      },
      "intervalSeconds",
    ],
    ["monitoring_templates_activate", { templateId: "health", version: "1", workspaceId: "other" }, "workspaceId"],
  ] as const) {
    await assert.rejects(
      () => dispatchTool(name, args),
      (error) =>
        errorInfo(error).code === "VALIDATION_ERROR" && fieldErrors(error).some((field) => field.path === path),
    );
  }
});
