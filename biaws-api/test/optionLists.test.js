import assert from "node:assert/strict";
import test from "node:test";

import { normalizeOptionListPayload } from "../src/repositories/optionListsRepository.js";

test("normalizes, orders and preserves option metadata", () => {
  const list = normalizeOptionListPayload({
    key: "demand.status",
    name: "Status",
    defaultValue: "Novo",
    items: [
      { value: "Concluído", active: true, order: 20 },
      {
        value: "Novo",
        label: "Novo",
        active: true,
        order: 10,
        metadata: { color: "#fff" },
      },
    ],
  });

  assert.deepEqual(
    list.items.map((item) => item.value),
    ["Novo", "Concluído"],
  );
  assert.deepEqual(list.items[0].metadata, { color: "#fff" });
});

test("rejects duplicate values and inactive defaults", () => {
  assert.throws(
    () =>
      normalizeOptionListPayload({
        key: "demand.status",
        name: "Status",
        items: [{ value: "Novo" }, { value: "Novo" }],
      }),
    /duplicate value/u,
  );
  assert.throws(
    () =>
      normalizeOptionListPayload({
        key: "demand.status",
        name: "Status",
        defaultValue: "Antigo",
        items: [{ value: "Antigo", active: false }],
      }),
    /defaultValue must reference an active item/u,
  );
});

test("normalizes EML detection rules for issue types", () => {
  const list = normalizeOptionListPayload({
    key: "issue.type",
    name: "Tipos",
    defaultValue: "change",
    items: [
      {
        value: "change",
        metadata: {
          emlImport: {
            enabled: true,
            subjectPatterns: [String.raw`\b(?<code>CHG-\d+)\b`],
          },
        },
      },
    ],
  });

  assert.deepEqual(list.items[0].metadata.emlImport, {
    enabled: true,
    subjectPatterns: [String.raw`\b(?<code>CHG-\d+)\b`],
  });
});

test("rejects invalid EML detection expressions", () => {
  assert.throws(
    () =>
      normalizeOptionListPayload({
        key: "issue.type",
        name: "Tipos",
        items: [
          {
            value: "change",
            metadata: {
              emlImport: { enabled: true, subjectPatterns: ["("] },
            },
          },
        ],
      }),
    /subjectPatterns\[0\] is invalid/u,
  );
});
