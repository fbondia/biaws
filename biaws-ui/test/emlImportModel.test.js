import assert from "node:assert/strict";
import test from "node:test";

import {
  cloneEmlClassification,
  contextFromPreviewIssue,
  mergeEmlClassificationSection,
  selectedEmlTaxonomyIds,
  shouldRetryContextDiscovery,
} from "../src/components/issues/ImportEmlDialog/model.js";

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

test("classification selectors update taxonomy and tags independently", () => {
  const current = {
    primaryTaxonomyId: "current-primary",
    secondaryTaxonomyIds: ["current-secondary"],
    summary: "Resumo preservado",
    tags: { urgency: ["high"] },
  };
  const draft = {
    primaryTaxonomyId: "next-primary",
    secondaryTaxonomyIds: ["next-secondary"],
    tags: { channel: ["email"] },
  };

  assert.deepEqual(mergeEmlClassificationSection(current, draft, "taxonomy"), {
    primaryTaxonomyId: "next-primary",
    secondaryTaxonomyIds: ["next-secondary"],
    summary: "Resumo preservado",
    tags: { urgency: ["high"] },
  });
  assert.deepEqual(mergeEmlClassificationSection(current, draft, "tags"), {
    primaryTaxonomyId: "current-primary",
    secondaryTaxonomyIds: ["current-secondary"],
    summary: "Resumo preservado",
    tags: { channel: ["email"] },
  });
});

test("classification cloning does not share taxonomy or tag arrays", () => {
  const source = {
    secondaryTaxonomyIds: ["secondary"],
    tags: { channel: ["email"] },
  };
  const clone = cloneEmlClassification(source);

  clone.secondaryTaxonomyIds.push("another");
  clone.tags.channel.push("chat");

  assert.deepEqual(source, {
    secondaryTaxonomyIds: ["secondary"],
    tags: { channel: ["email"] },
  });
});

test("selected EML taxonomies keep the primary item before secondary items", () => {
  assert.deepEqual(
    selectedEmlTaxonomyIds({
      primaryTaxonomyId: "primary",
      secondaryTaxonomyIds: ["secondary", ""],
    }),
    ["primary", "secondary"],
  );
});
