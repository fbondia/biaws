import { bootstrapUserId } from "./bootstrapTypes.js";
import type { BootstrapRecord, BootstrapDatabase, BootstrapAgentAuth } from "./bootstrapTypes.js";
import type { getServerConfig } from "../config.js";
import { defaultKeyHasher } from "@better-auth/api-key";

import { COLLECTION_NAMES } from "../database/collectionNames.js";

function apiKeyRateLimitFields(rateLimit: ReturnType<typeof getServerConfig>["rateLimit"]["apiKey"]) {
  return {
    rateLimitEnabled: rateLimit.enabled,
    rateLimitTimeWindow: rateLimit.windowSeconds * 1_000,
    rateLimitMax: rateLimit.maxRequests,
  };
}

export async function bootstrapAgent({
  auth,
  database,
  email,
  password,
  name,
  keyName = "Bondia Workspaces agent",
  metadataKind = "bootstrap-agent",
  existingApiKey,
  rateLimit,
  assignAgent,
  log = console.log,
}: {
  auth: BootstrapAgentAuth;
  database: BootstrapDatabase;
  email: string;
  password: string;
  name: string;
  keyName?: string;
  metadataKind?: string;
  existingApiKey?: string;
  rateLimit: ReturnType<typeof getServerConfig>["rateLimit"]["apiKey"];
  assignAgent: (userId: string) => Promise<unknown>;
  log?: (value: string) => void;
}) {
  const normalizedEmail = email.toLowerCase();
  let user: BootstrapRecord | null = await database.collection(COLLECTION_NAMES.AUTH_USERS).findOne({
    email: normalizedEmail,
    banned: { $ne: true },
  });
  let created = false;

  if (user) {
    log(`Technical agent identity already exists: ${user.email}`);
  } else {
    const result = await auth.api.createUser({
      body: {
        email: normalizedEmail,
        password,
        name,
        role: "user",
      },
    });
    user = result.user;
    created = true;
    log(`Technical agent identity created: ${user.email}`);
  }

  const userId = bootstrapUserId(user);
  await assignAgent(userId);
  const rateLimitFields = apiKeyRateLimitFields(rateLimit);

  if (existingApiKey) {
    const keyHash = await defaultKeyHasher(existingApiKey);
    const apiKeys = database.collection(COLLECTION_NAMES.AUTH_API_KEYS);
    const storedApiKey = await apiKeys.findOne({
      key: keyHash,
      referenceId: userId,
      enabled: { $ne: false },
    });
    const hasExpired = storedApiKey?.expiresAt && new Date(storedApiKey.expiresAt).getTime() <= Date.now();

    if (storedApiKey && !hasExpired) {
      if (!apiKeys.updateOne) throw new Error("API key collection does not support updateOne");
      await apiKeys.updateOne(
        { _id: storedApiKey._id },
        {
          $set: {
            ...rateLimitFields,
            requestCount: 0,
            lastRequest: null,
            updatedAt: new Date(),
          },
        },
      );
      log(`Technical agent API key rate limit reconciled: ${keyName}`);
      return {
        created,
        user,
        apiKey: { ...storedApiKey, ...rateLimitFields, key: existingApiKey },
      };
    }
  }

  const apiKey = await auth.api.createApiKey({
    body: {
      name: keyName,
      userId,
      metadata: { kind: metadataKind },
      ...rateLimitFields,
    },
  });

  return { created, user, apiKey };
}
