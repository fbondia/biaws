import assert from "node:assert/strict";
import test from "node:test";

import { buildIssueFilter, getPagination } from "../src/helpers/query.js";

test("builds multiple issue type and status filters with $in", () => {
  const filter = buildIssueFilter({
    type: "incident,request",
    status: "open,closed",
  });

  assert.deepEqual(filter.type, { $in: ["incident", "request"] });
  assert.deepEqual(filter.status, { $in: ["open", "closed"] });
});

test("keeps a single issue type and status as exact filters", () => {
  const filter = buildIssueFilter({
    type: "incident",
    status: "open",
  });

  assert.equal(filter.type, "incident");
  assert.equal(filter.status, "open");
});

test("adds application context to issue filters", () => {
  const filter = buildIssueFilter({
    workspaceId: "workspace-1",
    applicationId: "application-1",
    componentId: "component-1",
  });

  assert.equal(filter.workspaceId, "workspace-1");
  assert.equal(filter.applicationId, "application-1");
  assert.equal(filter.affectedComponentIds, "component-1");
});

test("invalid query values are classified as actionable client errors", () => {
  assert.throws(
    () => getPagination({ page: "invalid" }),
    (error) =>
      error.statusCode === 422 &&
      error.code === "INVALID_QUERY" &&
      error.message === "page must be a positive integer.",
  );
});
