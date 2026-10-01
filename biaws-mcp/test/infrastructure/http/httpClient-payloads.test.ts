import assert from "node:assert/strict";
import test from "node:test";
import { fetchJson } from "../../../src/api/httpClient.js";
import { errorInfo } from "../../helpers/types.js";
for (const payload of [{ items: [{ id: 42 }] }, { items: "invalid" }, { meta: { total: "10" } }]) {
  test(`malformed upstream data fails without retries: ${JSON.stringify(payload)}`, async (t) => {
    const previous = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      return Response.json(payload);
    };
    t.after(() => {
      globalThis.fetch = previous;
    });
    await assert.rejects(
      fetchJson("/api/issues"),
      (error) =>
        errorInfo(error).code === "INVALID_UPSTREAM_PAYLOAD" &&
        errorInfo(error).statusCode === 502 &&
        errorInfo(error).retryable === false,
    );
    assert.equal(calls, 1);
  });
}

test("unknown upstream fields survive schema validation at every level", async (t) => {
  const previous = globalThis.fetch;
  const payload = {
    extension: { enabled: true },
    meta: { total: 1, runtimeId: "runtime-a" },
    request: {
      id: "demand-a",
      custom: "preserved",
      specification: {
        sections: [{ title: "Scope", extension: 7 }],
        revision: 2,
      },
    },
  };
  globalThis.fetch = async () => Response.json(payload);
  t.after(() => {
    globalThis.fetch = previous;
  });
  assert.deepEqual(await fetchJson("/api/requests/demand-a"), payload);
});

test("nullable document context and identifier survive schema validation", async (t) => {
  const previous = globalThis.fetch;
  const payload = {
    items: [
      {
        id: "workspace-guide",
        applicationId: null,
        identifier: null,
        documentType: "guideline",
      },
    ],
  };
  globalThis.fetch = async () => Response.json(payload);
  t.after(() => {
    globalThis.fetch = previous;
  });
  assert.deepEqual(await fetchJson("/api/knowledge/documents"), payload);
});

test("nullable issue comment dates survive schema validation", async (t) => {
  const previous = globalThis.fetch;
  const payload = {
    comments: [
      {
        _id: "legacy-comment",
        issueId: "issue-a",
        text: "Imported comment without a recognized date",
        date: null,
      },
    ],
  };
  globalThis.fetch = async () => Response.json(payload);
  t.after(() => {
    globalThis.fetch = previous;
  });
  assert.deepEqual(await fetchJson("/api/issues/issue-a"), payload);
});

test("query parameters preserve scalars and reject objects before HTTP", async (t) => {
  const previous = globalThis.fetch;
  const calls: URL[] = [];
  globalThis.fetch = async (input) => {
    calls.push(new URL(String(input)));
    return Response.json({ items: [] });
  };
  t.after(() => {
    globalThis.fetch = previous;
  });
  await fetchJson("/api/issues", {
    page: 2,
    includeArchived: false,
    search: "example",
  });
  assert.equal(calls[0].search, "?page=2&includeArchived=false&search=example");
  await assert.rejects(fetchJson("/api/issues", { search: { id: "unexpected" } }), /Expected a scalar text value/u);
  assert.equal(calls.length, 1);
});
