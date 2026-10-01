import assert from "node:assert/strict";
import test from "node:test";
import { hashComment, normalizeCommentPayload } from "../../src/repositories/issues/comments/normalization.js";
import { errorStatusCode } from "../../src/helpers/error.js";

test("comment dates distinguish unknown dates from omitted dates", () => {
  const before = Date.now();
  const created = normalizeCommentPayload({ text: "New comment" });
  assert.ok(created.date);
  assert.ok(created.date.getTime() >= before && created.date.getTime() <= Date.now());
  assert.equal(normalizeCommentPayload({ text: "Unknown", date: null }).date, null);
  assert.equal(normalizeCommentPayload({ text: "Edited" }, null).date, null);
  const date = new Date("2026-07-30T13:42:15.123Z");
  assert.equal(normalizeCommentPayload({ text: "Edited" }, date).date, date);
  assert.equal(normalizeCommentPayload({ text: "Cleared", date: null }, date).date, null);
  assert.equal(
    normalizeCommentPayload({ text: "Dated", date: "2026-07-31" }, null).date?.toISOString(),
    "2026-07-31T00:00:00.000Z",
  );
});

test("invalid comment dates are rejected instead of being replaced by the current time", () => {
  for (const date of ["", "   ", "not-a-date", false, {}, new Date("invalid")]) {
    assert.throws(
      () => normalizeCommentPayload({ text: "Comment", date }),
      (error) => errorStatusCode(error) === 422,
    );
  }
  assert.equal(normalizeCommentPayload({ text: "Epoch", date: 0 }).date?.getTime(), 0);
});

test("comment hashes support unknown dates deterministically", () => {
  assert.equal(hashComment("ISSUE-1", "Comment", null), hashComment("ISSUE-1", "Comment", null));
  assert.notEqual(hashComment("ISSUE-1", "Comment", null), hashComment("ISSUE-1", "Edited", null));
  assert.notEqual(hashComment("ISSUE-1", "Comment", null), hashComment("ISSUE-1", "Comment", new Date("2026-07-30")));
});
