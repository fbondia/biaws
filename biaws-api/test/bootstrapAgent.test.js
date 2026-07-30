import assert from "node:assert/strict";
import test from "node:test";

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
