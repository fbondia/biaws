import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { required } from "../../helpers/types.js";
import { withApi } from "./apiCoverageTools.fixtures.js";
test("read defaults are applied and bounded to API contracts", async () => {
  await withApi(null, async (calls) => {
    await dispatchTool("audit_events_list", {
      entityType: "issue",
      entityId: "issue-1",
    });
    assert.equal(
      required(required(calls.at(-1)).url).searchParams.get("limit"),
      "100",
    );
    await dispatchTool("runtime_monitoring_signals_list", {
      runtimeReference: "runtime-1",
    });
    assert.equal(
      required(required(calls.at(-1)).url).searchParams.get("page"),
      "1",
    );
    assert.equal(
      required(required(calls.at(-1)).url).searchParams.get("limit"),
      "50",
    );
    await dispatchTool("applications_monitoring_health_get", {
      applicationId: "app-1",
    });
    assert.equal(
      required(required(calls.at(-1)).url).searchParams.get(
        "includeConfigured",
      ),
      "false",
    );
  });
});
