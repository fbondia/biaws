import { COLLECTION_NAMES } from "../database/collectionNames.js";

const AUTH_INDEXES = Object.freeze({
  [COLLECTION_NAMES.AUTH_USERS]: [
    [{ email: 1 }, { name: "auth_user_email_unique", unique: true }],
    [{ role: 1, banned: 1 }, { name: "auth_user_admin_lookup" }],
  ],
  [COLLECTION_NAMES.AUTH_ACCOUNTS]: [
    [
      { providerId: 1, accountId: 1 },
      { name: "auth_account_provider_unique", unique: true },
    ],
    [{ userId: 1 }, { name: "auth_account_user" }],
  ],
  [COLLECTION_NAMES.AUTH_SESSIONS]: [
    [{ token: 1 }, { name: "auth_session_token_unique", unique: true }],
    [{ userId: 1 }, { name: "auth_session_user" }],
    [
      { expiresAt: 1 },
      { name: "auth_session_expiration_ttl", expireAfterSeconds: 0 },
    ],
  ],
  [COLLECTION_NAMES.AUTH_VERIFICATIONS]: [
    [{ identifier: 1 }, { name: "auth_verification_identifier" }],
    [
      { expiresAt: 1 },
      { name: "auth_verification_expiration_ttl", expireAfterSeconds: 0 },
    ],
  ],
  [COLLECTION_NAMES.AUTH_API_KEYS]: [
    [{ key: 1 }, { name: "auth_api_key_hash_unique", unique: true }],
    [{ referenceId: 1 }, { name: "auth_api_key_user" }],
    [
      { expiresAt: 1 },
      {
        name: "auth_api_key_expiration_ttl",
        expireAfterSeconds: 0,
        partialFilterExpression: { expiresAt: { $type: "date" } },
      },
    ],
  ],
});

export async function ensureAuthIndexes(database) {
  await Promise.all(
    Object.entries(AUTH_INDEXES).flatMap(([collectionName, indexes]) =>
      indexes.map(([keys, options]) =>
        database.collection(collectionName).createIndex(keys, options),
      ),
    ),
  );
}
