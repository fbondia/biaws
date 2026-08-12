import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";

export const COLLECTION_NAVIGATION_CONTEXTS = Object.freeze([
  "applications",
  "documents",
  "demands",
  "secrets",
  "skills",
  "servers",
]);

const MAX_COLLECTION_ID_LENGTH = 200;
let collectionPromise;

function preferenceError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function assertCollectionNavigationContext(value) {
  const context = String(value || "").trim();
  if (!COLLECTION_NAVIGATION_CONTEXTS.includes(context)) {
    throw preferenceError(
      404,
      "COLLECTION_NAVIGATION_CONTEXT_NOT_FOUND",
      `Contexto de navegação não suportado: ${context}`,
    );
  }
  return context;
}

function normalizeCollectionId(value) {
  const collectionId = String(value || "").trim();
  if (!collectionId || collectionId.length > MAX_COLLECTION_ID_LENGTH) {
    throw preferenceError(
      422,
      "INVALID_COLLECTION_NAVIGATION_PREFERENCE",
      `collectionId deve conter entre 1 e ${MAX_COLLECTION_ID_LENGTH} caracteres`,
    );
  }
  return collectionId;
}

export function normalizeCollectionNavigationMutation(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const unknown = Object.keys(source).filter(
    (key) => !["collectionId", "collapsed"].includes(key),
  );
  if (unknown.length) {
    throw preferenceError(
      422,
      "INVALID_COLLECTION_NAVIGATION_PREFERENCE",
      `Campos de preferência desconhecidos: ${unknown.join(", ")}`,
    );
  }
  if (typeof source.collapsed !== "boolean") {
    throw preferenceError(
      422,
      "INVALID_COLLECTION_NAVIGATION_PREFERENCE",
      "collapsed deve ser booleano",
    );
  }
  return {
    collectionId: normalizeCollectionId(source.collectionId),
    collapsed: source.collapsed,
  };
}

function normalizePreference(context, document) {
  const preference = document?.collectionNavigation?.[context] || {};
  return {
    context,
    collapsedCollectionIds: [
      ...new Set(
        (preference.collapsedCollectionIds || [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    ],
    updatedAt: preference.updatedAt || null,
  };
}

async function preferencesCollection() {
  if (!collectionPromise) {
    collectionPromise = (async () => {
      const database = await getMongoDatabase();
      const collection = database.collection(COLLECTION_NAMES.USER_PREFERENCES);
      await Promise.all([
        collection.createIndex(
          { workspaceId: 1, userId: 1 },
          { unique: true, name: "workspace_user_preferences_unique" },
        ),
        collection.createIndex({ workspaceId: 1, updatedAt: -1 }),
      ]);
      return collection;
    })().catch((error) => {
      collectionPromise = undefined;
      throw error;
    });
  }
  return collectionPromise;
}

export async function getCollectionNavigationPreference(contextValue, actor) {
  const context = assertCollectionNavigationContext(contextValue);
  const collection = await preferencesCollection();
  const document = await collection.findOne({
    workspaceId: actor.workspaceId,
    userId: actor.userId,
  });
  return normalizePreference(context, document);
}

export function buildCollectionNavigationUpdateOperation(
  contextValue,
  payload,
  actor,
  now = new Date(),
) {
  const context = assertCollectionNavigationContext(contextValue);
  const { collectionId, collapsed } =
    normalizeCollectionNavigationMutation(payload);
  const collapsedPath = `collectionNavigation.${context}.collapsedCollectionIds`;
  const contextUpdatedAtPath = `collectionNavigation.${context}.updatedAt`;

  return {
    context,
    filter: { workspaceId: actor.workspaceId, userId: actor.userId },
    update: {
      [collapsed ? "$addToSet" : "$pull"]: {
        [collapsedPath]: collectionId,
      },
      $set: {
        [contextUpdatedAtPath]: now,
        updatedAt: now,
        updatedBy: actor.userId,
      },
      $setOnInsert: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        createdAt: now,
      },
    },
  };
}

export async function updateCollectionNavigationPreference(
  contextValue,
  payload,
  actor,
) {
  const collection = await preferencesCollection();
  const now = new Date();
  const operation = buildCollectionNavigationUpdateOperation(
    contextValue,
    payload,
    actor,
    now,
  );

  await collection.updateOne(operation.filter, operation.update, {
    upsert: true,
  });

  const document = await collection.findOne(operation.filter);
  return normalizePreference(operation.context, document);
}
