import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
test("document type catalog exposes context, states and typed details", async () => {
  const result = await dispatchTool("document_types_list", {});
  assert.equal(result.documentTypes.length, 6);
  assert.equal(
    required(result.documentTypes.find(({ type }) => type === "business-rule"))
      .context.applicationId,
    "required",
  );
  assert.deepEqual(
    Reflect.get(
      required(result.documentTypes.find(({ type }) => type === "guideline"))
        .details,
      "scope",
    ).enum,
    ["workspace", "application", "component"],
  );
  const procedure = required(
    result.documentTypes.find(({ type }) => type === "procedure"),
  );
  assert.equal(procedure.context.applicationId, "optional");
  assert.deepEqual(procedure.details, {});
});
