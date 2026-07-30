import assert from "node:assert/strict";
import test from "node:test";

import { bootstrapAdmin } from "../src/auth/bootstrapAdmin.js";
import { COLLECTION_NAMES } from "../src/database/collectionNames.js";

function createDatabase(existingAdmin) {
  return {
    collection(name) {
      assert.equal(name, COLLECTION_NAMES.AUTH_USERS);
      return {
        async findOne(query) {
          assert.deepEqual(query, {
            role: { $regex: "(^|,)admin(,|$)" },
            banned: { $ne: true },
          });
          return existingAdmin;
        },
      };
    },
  };
}

test("bootstrap creates the first administrator through Better Auth", async () => {
  let receivedBody;
  let assignedUserId;
  const logs = [];
  const auth = {
    api: {
      async createUser({ body }) {
        receivedBody = body;
        return { user: { id: "user-1", email: body.email } };
      },
    },
  };

  const result = await bootstrapAdmin({
    auth,
    database: createDatabase(null),
    email: "ADMIN@EXAMPLE.COM",
    password: "uma senha longa",
    name: "Administrador",
    log: (message) => logs.push(message),
    assignAdministration: async (userId) => {
      assignedUserId = userId;
    },
  });

  assert.equal(result.created, true);
  assert.deepEqual(receivedBody, {
    email: "admin@example.com",
    password: "uma senha longa",
    name: "Administrador",
    role: "admin",
  });
  assert.equal(logs.length, 1);
  assert.equal(assignedUserId, "user-1");
});

test("bootstrap is idempotent when an active administrator exists", async () => {
  const existingAdmin = { id: "admin-1", role: "admin" };
  let assignedUserId;
  const auth = {
    api: {
      async createUser() {
        assert.fail("createUser must not run");
      },
    },
  };

  const result = await bootstrapAdmin({
    auth,
    database: createDatabase(existingAdmin),
    email: "admin@example.com",
    password: "uma senha longa",
    name: "Administrador",
    log: () => {},
    assignAdministration: async (userId) => {
      assignedUserId = userId;
    },
  });

  assert.equal(result.created, false);
  assert.equal(result.user, existingAdmin);
  assert.equal(assignedUserId, "admin-1");
});
