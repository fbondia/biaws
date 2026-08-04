import assert from "node:assert/strict";
import test from "node:test";

import { normalizeClassificationPayload } from "../src/helpers/issueClassification.js";

test("normalizes taxonomy and tag selections used by EML imports", () => {
  assert.deepEqual(
    normalizeClassificationPayload({
      primaryTaxonomyId: " incident ",
      secondaryTaxonomyIds: ["network", "incident", "network", ""],
      tags: {
        priority: ["high", " high ", ""],
      },
    }),
    {
      primaryTaxonomyId: "incident",
      secondaryTaxonomyIds: ["network"],
      summary: "",
      tags: { priority: ["high"] },
    },
  );
});

test("rejects malformed tag selections used by EML imports", () => {
  assert.throws(
    () =>
      normalizeClassificationPayload({
        tags: { priority: "high" },
      }),
    (error) =>
      error.statusCode === 422 &&
      /tags\.priority must be an array/u.test(error.message),
  );
});
