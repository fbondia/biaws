import assert from "node:assert/strict";
import test from "node:test";

import {
  contextFromPreviewIssue,
  shouldRetryContextDiscovery,
} from "../src/components/issues/emlImportModel.js";

test("EML preview adopts the application and components of an existing issue", () => {
  const fallback = {
    applicationId: "first-application",
    affectedComponentIds: [],
  };

  assert.deepEqual(
    contextFromPreviewIssue(
      {
        applicationId: "original-application",
        affectedComponentIds: ["original-component"],
      },
      fallback,
    ),
    {
      applicationId: "original-application",
      affectedComponentIds: ["original-component"],
    },
  );
});

test("new EML issues retry context discovery with the default application", () => {
  assert.equal(
    shouldRetryContextDiscovery({ code: "APPLICATION_REQUIRED" }, true, {
      applicationId: "first-application",
    }),
    true,
  );
  assert.equal(
    shouldRetryContextDiscovery({ code: "INVALID_AFFECTED_COMPONENTS" }, true, {
      applicationId: "first-application",
    }),
    false,
  );
});
