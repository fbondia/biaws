import { COLLECTION_NAMES } from "../database/collectionNames.js";
import {
  DEFAULT_EMAIL_SANITIZATION_CONFIG,
  normalizeEmailSanitizationConfig,
} from "../helpers/emailSanitization.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";

const COLLECTION = COLLECTION_NAMES.EMAIL_SANITIZATION_CONFIGS;

function workspaceId(query = {}) {
  return String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
}

function response(document, effectiveWorkspaceId) {
  return {
    workspaceId: effectiveWorkspaceId,
    source: document ? "stored" : "default",
    version: document?.version || 0,
    config: normalizeEmailSanitizationConfig(
      document?.config || DEFAULT_EMAIL_SANITIZATION_CONFIG,
    ),
    updatedAt: document?.updatedAt || null,
    updatedBy: document?.updatedBy || "",
  };
}

async function collection(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const result = db.collection(COLLECTION);
  await result.createIndex({ workspaceId: 1 }, { unique: true });
  return { collection: result, workspaceId: workspaceId(query) };
}

export async function getEmailSanitizationConfiguration(query = {}) {
  const context = await collection(query);
  const document = await context.collection.findOne({
    workspaceId: context.workspaceId,
  });
  return response(document, context.workspaceId);
}

export async function saveEmailSanitizationConfiguration(
  payload = {},
  query = {},
) {
  const context = await collection(query);
  const config = normalizeEmailSanitizationConfig(payload.config ?? payload);
  const now = new Date();
  await context.collection.updateOne(
    { workspaceId: context.workspaceId },
    {
      $set: {
        config,
        updatedAt: now,
        updatedBy: String(query.actor || ""),
      },
      $setOnInsert: {
        workspaceId: context.workspaceId,
        createdAt: now,
      },
      $inc: { version: 1 },
    },
    { upsert: true },
  );
  return response(
    await context.collection.findOne({ workspaceId: context.workspaceId }),
    context.workspaceId,
  );
}
