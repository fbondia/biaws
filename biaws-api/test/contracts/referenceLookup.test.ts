import { errorCode, errorStatusCode } from "../../src/helpers/error.js";
import assert from "node:assert/strict";
import test from "node:test";
import { findByReference } from "../../src/helpers/referenceLookup.js";
import type { Collection } from "mongodb";

test("an ID wins over a colliding identifier without running the fallback", async () => {
  const filter = {
    workspaceId: "workspace-a",
    applicationId: { $in: ["app-a"] },
  };
  const document = { id: "INC1" };
  const collection = {
    async findOne(query: unknown) {
      assert.deepEqual(query, { $and: [filter, { id: "INC1" }] });
      return document;
    },
    find() {
      assert.fail("identifier lookup must not run when an ID exists");
    },
  };
  assert.equal(
    await findByReference(collection as unknown as Collection<{ id: string }>, "INC1", {
      filter,
      identifierField: "identifier",
    }),
    document,
  );
});

test("a non-ObjectId identifier uses the same authorized filter and detects ambiguity", async () => {
  const filter = { workspaceId: "workspace-a", applicationId: "app-a" };
  const collection = {
    findOne() {
      assert.fail("invalid ObjectId must not be converted or queried");
    },
    find(query: unknown) {
      assert.deepEqual(query, { $and: [filter, { clientCode: "MEL1" }] });
      return {
        limit(value: unknown) {
          assert.equal(value, 2);
          return {
            async toArray() {
              return [{ _id: "one" }, { _id: "two" }];
            },
          };
        },
      };
    },
  };
  await assert.rejects(
    findByReference(collection as unknown as Collection<{ _id: string }>, "MEL1", {
      filter,
      idField: "_id",
      identifierField: "clientCode",
    }),
    (error) => errorStatusCode(error) === 409 && errorCode(error) === "AMBIGUOUS_REFERENCE",
  );
});

test("a valid but absent ObjectId also falls back to the business code", async () => {
  const calls: Array<{ $and: Array<Record<string, unknown>> }> = [];
  const collection = {
    async findOne(query: { $and: Array<Record<string, unknown>> }) {
      calls.push(query);
      return null;
    },
    find(query: { $and: Array<Record<string, unknown>> }) {
      calls.push(query);
      return {
        limit() {
          return {
            async toArray() {
              return [{ _id: "found" }];
            },
          };
        },
      };
    },
  };
  const reference = "507f1f77bcf86cd799439011";
  const found = await findByReference(collection as unknown as Collection<{ _id: string }>, reference, {
    idField: "_id",
    identifierField: "code",
    filter: { requestId: "parent" },
  });
  assert.ok(found);
  assert.equal(found._id, "found");
  assert.equal(String(calls[0].$and[1]._id), reference);
  assert.equal(calls[1].$and[1].code, reference);
  assert.deepEqual(calls[0].$and[0], calls[1].$and[0]);
});

test("Mongo _id lookup keeps the authorized filter and wins over a business identifier", async () => {
  const reference = "507f1f77bcf86cd799439011";
  const filter = { workspaceId: "workspace-a", applicationId: { $in: ["app-a"] } };
  let calls = 0;
  const collection = {
    async findOne(query: { $and: Array<Record<string, unknown>> }) {
      assert.deepEqual(query.$and[0], filter);
      calls += 1;
      if (calls === 1) {
        assert.equal(query.$and[1].id, reference);
        return null;
      }
      assert.equal(String(query.$and[1]._id), reference);
      return { id: "canonical-id" };
    },
    find() {
      assert.fail("business identifier must not supersede a Mongo ID");
    },
  };
  assert.equal(
    (
      await findByReference(collection as unknown as Collection<{ id: string }>, reference, {
        filter,
        identifierField: "identifier",
      })
    )?.id,
    "canonical-id",
  );
  assert.equal(calls, 2);
});
