import assert from "node:assert/strict";
import test from "node:test";

import { ensureAuthIndexes } from "../src/auth/authIndexes.js";
import { COLLECTION_NAMES } from "../src/database/collectionNames.js";

test("creates unique lookup and TTL indexes for Better Auth collections", async () => {
  const calls = [];
  const database = {
    collection(collectionName) {
      return {
        async createIndex(keys, options) {
          calls.push({ collectionName, keys, options });
        },
      };
    },
  };

  await ensureAuthIndexes(database);

  assert.ok(
    calls.some(
      ({ collectionName, keys, options }) =>
        collectionName === COLLECTION_NAMES.AUTH_USERS &&
        keys.email === 1 &&
        options.unique === true,
    ),
  );
  assert.ok(
    calls.some(
      ({ collectionName, keys, options }) =>
        collectionName === COLLECTION_NAMES.AUTH_SESSIONS &&
        keys.expiresAt === 1 &&
        options.expireAfterSeconds === 0,
    ),
  );
  assert.ok(
    calls.some(
      ({ collectionName, keys, options }) =>
        collectionName === COLLECTION_NAMES.AUTH_ACCOUNTS &&
        keys.providerId === 1 &&
        keys.accountId === 1 &&
        options.unique === true,
    ),
  );
  assert.ok(
    calls.some(
      ({ collectionName, keys, options }) =>
        collectionName === COLLECTION_NAMES.AUTH_API_KEYS &&
        keys.key === 1 &&
        options.unique === true,
    ),
  );
});
