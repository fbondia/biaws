import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTagGroupsById,
  buildTaxonomyItemsById,
  issueListText,
  issueTagItems,
  issueTaxonomyItems,
  optionLabel,
} from "../src/components/issues/IssueList/model.js";
import { textPreview } from "../src/utils/issues.js";

test("issue list taxonomy items preserve paths, primary state and uniqueness", () => {
  const itemsById = buildTaxonomyItemsById([
    {
      id: "root",
      label: "Root",
      children: [{ id: "child", label: "Child" }],
    },
  ]);

  assert.deepEqual(
    issueTaxonomyItems(
      {
        classification: {
          primaryTaxonomyId: "child",
          secondaryTaxonomyIds: ["root", "child", "unknown"],
        },
      },
      itemsById,
    ),
    [
      {
        id: "child",
        label: "Child",
        path: ["Root", "Child"],
        isPrimary: true,
      },
      { id: "root", label: "Root", path: ["Root"], isPrimary: false },
      {
        id: "unknown",
        label: "unknown",
        path: ["unknown"],
        isPrimary: false,
      },
    ],
  );
});

test("issue list tags use configured groups and tolerate unknown groups", () => {
  const groups = buildTagGroupsById({
    tagGroups: [{ id: "channel", label: "Canal", color: "#123456" }],
  });
  const items = issueTagItems(
    {
      classification: {
        tags: { channel: ["email"], unknown: ["legacy"] },
      },
    },
    groups,
  );

  assert.equal(items[0].group, groups.channel);
  assert.equal(items[0].tagId, "email");
  assert.equal(items[1].group.label, "unknown");
  assert.equal(items[1].tagId, "legacy");
});

test("issue list option labels prefer the catalog and fall back safely", () => {
  const options = [{ value: "incident", label: "Incidente" }];

  assert.equal(optionLabel(options, "incident"), "Incidente");
  assert.equal(optionLabel(options, "legacy"), "legacy");
  assert.equal(optionLabel(options, ""), "-");
});

test("issue list text prefers the classification summary", () => {
  assert.equal(
    issueListText({
      text: "Descrição original",
      classification: { summary: "  Correção aplicada  " },
    }),
    "Correção aplicada",
  );
});

test("issue list text falls back to the issue description without a summary", () => {
  assert.equal(issueListText({ text: "Descrição original", classification: { summary: "   " } }), "Descrição original");
  assert.equal(issueListText({ text: "Descrição original" }), "Descrição original");
});

test("issue list preview preserves markdown and truncates after 300 characters", () => {
  const markdown = `## Título\n\n${"a".repeat(290)}`;

  assert.equal(textPreview(markdown), `${markdown.slice(0, 300)}...`);
  assert.equal(textPreview("- primeiro\n- segundo"), "- primeiro\n- segundo");
});
