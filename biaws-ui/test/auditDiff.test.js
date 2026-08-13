import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuditLineDiff,
  formatAuditValue,
} from "../src/components/shared/auditDiff.js";

test("audit values preserve multiline and structured content", () => {
  assert.equal(formatAuditValue(null), "—");
  assert.equal(formatAuditValue(true), "Sim");
  assert.equal(
    formatAuditValue({ status: "open" }),
    '{\n  "status": "open"\n}',
  );
});

test("audit diff marks retained, removed and added lines with line numbers", () => {
  assert.deepEqual(buildAuditLineDiff("primeira\nantiga", "primeira\nnova"), [
    {
      type: "equal",
      value: "primeira",
      beforeLine: 1,
      afterLine: 1,
    },
    {
      type: "removed",
      value: "antiga",
      beforeLine: 2,
      afterLine: null,
    },
    {
      type: "added",
      value: "nova",
      beforeLine: null,
      afterLine: 2,
    },
  ]);
});
