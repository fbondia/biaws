import type { Actor } from "../../types/http.js";
import {
  COLLECTION_NAVIGATION_CONTEXTS,
  MAX_COLLECTION_ID_LENGTH,
} from "./constants.js";
import { preferenceError } from "./support.js";
import { preferencesCollection } from "./storage.js";
import { isRecord } from "../../helpers/records.js";

export function assertCollectionNavigationContext(value: string) {
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

function normalizeCollectionId(value: unknown) {
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

export function normalizeCollectionNavigationMutation(payload: unknown = {}) {
  const source = isRecord(payload) ? payload : {};
  const unknown = Object.keys(source).filter(
    (key: string) => !["collectionId", "collapsed"].includes(key),
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

function normalizePreference(context: string, document: unknown) {
  const navigation =
    document &&
    typeof document === "object" &&
    "collectionNavigation" in document
      ? document.collectionNavigation
      : undefined;
  const rawPreference =
    navigation && typeof navigation === "object" && context in navigation
      ? (navigation as Record<string, unknown>)[context]
      : undefined;
  const preference =
    rawPreference &&
    typeof rawPreference === "object" &&
    !Array.isArray(rawPreference)
      ? (rawPreference as {
          collapsedCollectionIds?: unknown;
          updatedAt?: unknown;
        })
      : {};
  return {
    context,
    collapsedCollectionIds: [
      ...new Set(
        (Array.isArray(preference.collapsedCollectionIds)
          ? preference.collapsedCollectionIds
          : []
        )
          .map((id: unknown) => String(id || "").trim())
          .filter(Boolean),
      ),
    ],
    updatedAt: preference.updatedAt || null,
  };
}

export async function getCollectionNavigationPreference(
  contextValue: string | string[],
  actor: Actor,
) {
  const context = assertCollectionNavigationContext(String(contextValue));
  const collection = await preferencesCollection();
  const document = await collection.findOne({
    workspaceId: actor.workspaceId,
    userId: actor.userId,
  });
  return normalizePreference(context, document);
}

export function buildCollectionNavigationUpdateOperation(
  contextValue: string,
  payload: {} | undefined,
  actor: Partial<Actor>,
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
  contextValue: string | string[],
  payload: Record<string, unknown>,
  actor: Partial<Actor>,
) {
  const collection = await preferencesCollection();
  const now = new Date();
  const operation = buildCollectionNavigationUpdateOperation(
    String(contextValue),
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
