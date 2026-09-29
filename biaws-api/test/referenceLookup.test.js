import assert from "node:assert/strict";
import test from "node:test";
import { findByReference } from "../src/helpers/referenceLookup.js";

test("an ID wins over a colliding identifier without running the fallback", async () => {
  const filter = {
    workspaceId: "workspace-a",
    applicationId: { $in: ["app-a"] },
  };
  const document = { id: "INC1" };
  const collection = {
    async findOne(query) {
      assert.deepEqual(query, { $and: [filter, { id: "INC1" }] });
      return document;
    },
    find() {
      assert.fail("identifier lookup must not run when an ID exists");
    },
  };
  assert.equal(
    await findByReference(collection, "INC1", {
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
    find(query) {
      assert.deepEqual(query, { $and: [filter, { clientCode: "MEL1" }] });
      return {
        limit(value) {
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
    findByReference(collection, "MEL1", {
      filter,
      idField: "_id",
      identifierField: "clientCode",
    }),
    (error) => error.statusCode === 409 && error.code === "AMBIGUOUS_REFERENCE",
  );
});

test("a valid but absent ObjectId also falls back to the business code", async () => {
  const calls = [];
  const collection = {
    async findOne(query) {
      calls.push(query);
      return null;
    },
    find(query) {
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
  assert.equal(
    (
      await findByReference(collection, reference, {
        idField: "_id",
        identifierField: "code",
        filter: { requestId: "parent" },
      })
    )._id,
    "found",
  );
  assert.equal(calls[0].$and[1]._id.toString(), reference);
  assert.equal(calls[1].$and[1].code, reference);
  assert.deepEqual(calls[0].$and[0], calls[1].$and[0]);
});
