import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
import { response, taxonomyPayload } from "./taxonomyTools.fixtures.js";
test("updates taxonomy item configuration without dropping descendants", async () => {
  const originalFetch = globalThis.fetch;
  let writtenBody:
    | { taxonomy: import("../../../src/apiContracts.js").ApiEntity[] }
    | undefined;
  globalThis.fetch = async (_url, options = {}) => {
    if (!options.method) {
      return response(
        taxonomyPayload([
          {
            id: "operations",
            label: "Operations",
            applicationIds: [],
            children: [
              { id: "deployments", label: "Deployments", applicationIds: [] },
            ],
          },
        ]),
      );
    }
    writtenBody = JSON.parse(String(options.body));
    return response(taxonomyPayload(required(writtenBody).taxonomy));
  };

  try {
    const result = await dispatchTool("issues_update_taxonomy_item", {
      taxonomyId: "operations",
      label: "Platform operations",
      applicationIds: ["app-2", "app-2", " app-1 "],
    });

    assert.equal(
      required(writtenBody).taxonomy[0].label,
      "Platform operations",
    );
    assert.deepEqual(required(writtenBody).taxonomy[0].applicationIds, [
      "app-2",
      "app-1",
    ]);
    assert.equal(
      required(required(writtenBody).taxonomy[0].children)[0].id,
      "deployments",
    );
    assert.equal(required(result.item).label, "Platform operations");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
