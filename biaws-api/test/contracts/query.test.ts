import { errorCode, errorMessage, errorStatusCode } from "../../src/helpers/error.js";
import assert from "node:assert/strict";
import test from "node:test";

import { buildIssueFilter, getPagination } from "../../src/helpers/query.js";

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

test("searches issue codes and identifiers literally alongside other filters", () => {
  const codeMatch = { $regex: "inc\\.42", $options: "i" };
  const titleMatch = { $regex: "reported", $options: "i" };

  for (const key of ["codigo", "code"]) {
    assert.deepEqual(buildIssueFilter({ [key]: "inc.42", title: "reported", workspaceId: "workspace-1" }), {
      workspaceId: "workspace-1",
      $and: [{ $or: [{ id: codeMatch }, { identifier: codeMatch }] }, { title: titleMatch }],
    });
  }
  assert.deepEqual(buildIssueFilter({ id: "inc.42" }), { id: codeMatch });
});

test("invalid query values are classified as actionable client errors", () => {
  assert.throws(
    () => getPagination({ page: "invalid" }),
    (error) =>
      errorStatusCode(error) === 422 &&
      errorCode(error) === "INVALID_QUERY" &&
      errorMessage(error) === "page must be a positive integer.",
  );
});
