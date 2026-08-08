import assert from "node:assert/strict";
import test from "node:test";

import {
  detectEmlIssueType,
  newItem,
  removeItem,
} from "../src/components/settings/OptionListsView/model.js";

test("new issue types start with EML detection disabled", () => {
  const item = newItem({
    key: "issue.type",
    items: [{ order: 10 }],
  });

  assert.deepEqual(item.metadata.emlImport, {
    enabled: false,
    subjectPatterns: [],
  });
});

test("EML tester detects type and named code capture", () => {
  const detected = detectEmlIssueType("RE: CHG-00421 implantação", [
    {
      value: "change",
      label: "Mudança",
      active: true,
      order: 10,
      metadata: {
        emlImport: {
          enabled: true,
          subjectPatterns: [String.raw`\b(?<code>CHG-\d{5})\b`],
        },
      },
    },
  ]);

  assert.deepEqual(detected, {
    type: "change",
    label: "Mudança",
    code: "CHG-00421",
  });
});

test("removing a saved option also selects a valid replacement default", () => {
  const list = removeItem(
    {
      defaultValue: "new",
      items: [
        { value: "new", active: true },
        { value: "done", active: true },
      ],
    },
    0,
  );

  assert.deepEqual(list.items, [{ value: "done", active: true }]);
  assert.equal(list.defaultValue, "done");
});
