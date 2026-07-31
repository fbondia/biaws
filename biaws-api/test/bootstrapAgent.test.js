import assert from "node:assert/strict";
import test from "node:test";
import { defaultKeyHasher } from "@better-auth/api-key";

import { bootstrapAgent } from "../src/auth/bootstrapAgent.js";
import { COLLECTION_NAMES } from "../src/database/collectionNames.js";

function databaseWith(user) {
  return {
    collection(name) {
      assert.equal(name, COLLECTION_NAMES.AUTH_USERS);
      return {
        async findOne(query) {
          assert.deepEqual(query, {
            email: "agent@example.com",
            banned: { $ne: true },
          });
          return user;
        },
      };
    },
  };
}

test("bootstrap creates a least-privilege technical identity and API key", async () => {
  let assignedUserId;
  let keyBody;
  const auth = {
    api: {
      async createUser({ body }) {
        assert.deepEqual(body, {
          email: "agent@example.com",
          password: "generated-password",
          name: "Agent",
          role: "user",
        });
        return { user: { id: "agent-1", email: body.email } };
      },
      async createApiKey({ body }) {
        keyBody = body;
        return { key: "biaws_secret" };
      },
    },
  };

  const result = await bootstrapAgent({
    auth,
    database: databaseWith(null),
    email: "AGENT@EXAMPLE.COM",
    password: "generated-password",
    name: "Agent",
    rateLimit: { enabled: true, windowSeconds: 3600, maxRequests: 1000 },
    assignAgent: async (userId) => {
      assignedUserId = userId;
    },
    log: () => {},
  });

  assert.equal(result.created, true);
  assert.equal(assignedUserId, "agent-1");
  assert.deepEqual(keyBody, {
    name: "Bondia Workspaces agent",
    userId: "agent-1",
    metadata: { kind: "bootstrap-agent" },
    rateLimitEnabled: true,
    rateLimitTimeWindow: 3600000,
    rateLimitMax: 1000,
  });
});

test("bootstrap reuses the technical identity and rotates its API key", async () => {
  const existing = {
    _id: { toString: () => "agent-existing" },
    email: "agent@example.com",
  };
  let createUserCalled = false;
  let assignedUserId;
  const auth = {
    api: {
      async createUser() {
        createUserCalled = true;
      },
      async createApiKey({ body }) {
        assert.equal(body.userId, "agent-existing");
        return { key: "biaws_rotated" };
      },
    },
  };

  const result = await bootstrapAgent({
    auth,
    database: databaseWith(existing),
    email: "agent@example.com",
    password: "generated-password",
    name: "Agent",
    rateLimit: { enabled: true, windowSeconds: 3600, maxRequests: 1000 },
    assignAgent: async (userId) => {
      assignedUserId = userId;
    },
    log: () => {},
  });

  assert.equal(result.created, false);
  assert.equal(createUserCalled, false);
  assert.equal(assignedUserId, "agent-existing");
  assert.equal(result.apiKey.key, "biaws_rotated");
});

test("bootstrap preserves and reconciles a valid existing API key", async () => {
  const existingUser = {
    _id: { toString: () => "agent-existing" },
    email: "agent@example.com",
  };
  const plainKey = "biaws_existing_secret";
  const hashedKey = await defaultKeyHasher(plainKey);
  let update;
  const database = {
    collection(name) {
      if (name === COLLECTION_NAMES.AUTH_USERS) {
        return { findOne: async () => existingUser };
      }
      assert.equal(name, COLLECTION_NAMES.AUTH_API_KEYS);
      return {
        async findOne(query) {
          assert.deepEqual(query, {
            key: hashedKey,
            referenceId: "agent-existing",
            enabled: { $ne: false },
          });
          return {
            _id: "key-1",
            key: hashedKey,
            referenceId: "agent-existing",
            expiresAt: new Date(Date.now() + 60_000),
          };
        },
        async updateOne(filter, operation) {
          update = { filter, operation };
        },
      };
    },
  };

  const result = await bootstrapAgent({
    auth: { api: { createApiKey: () => assert.fail("must not rotate key") } },
    database,
    email: "agent@example.com",
    password: "generated-password",
    name: "Agent",
    existingApiKey: plainKey,
    rateLimit: { enabled: true, windowSeconds: 120, maxRequests: 50 },
    assignAgent: async () => {},
    log: () => {},
  });

  assert.equal(result.apiKey.key, plainKey);
  assert.deepEqual(update.filter, { _id: "key-1" });
  assert.equal(update.operation.$set.rateLimitEnabled, true);
  assert.equal(update.operation.$set.rateLimitTimeWindow, 120000);
  assert.equal(update.operation.$set.rateLimitMax, 50);
  assert.equal(update.operation.$set.requestCount, 0);
  assert.equal(update.operation.$set.lastRequest, null);
  assert.ok(update.operation.$set.updatedAt instanceof Date);
});
