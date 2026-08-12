#!/usr/bin/env node

import "../config.js";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { closeMongoClient, getMongoDatabase } from "../helpers/mongoClient.js";

const apply = process.argv.slice(2).includes("--apply");
const LEGACY_PROCEDURES = "procedures";
const LEGACY_COLLECTIONS = "procedureCollections";

const PERMISSION_MAP = Object.freeze({
  "procedures.read": "documents.read",
  "procedures.create": "documents.create",
  "procedures.update": "documents.update",
  "procedures.delete": "documents.archive",
  "procedures.attachment.read": "documents.attachment.read",
  "procedures.attachment.create": "documents.attachment.create",
  "procedures.attachment.update": "documents.attachment.update",
  "procedures.attachment.delete": "documents.attachment.delete",
});

function dateOnly(value, fallback = new Date()) {
  const date = new Date(value || fallback);
  return Number.isNaN(date.getTime())
    ? new Date(fallback).toISOString().slice(0, 10)
    : date.toISOString().slice(0, 10);
}

function migratedAttachments(attachments = []) {
  return attachments.map((attachment) => ({
    ...attachment,
    source: {
      ...(attachment.source || {}),
      entityType: "documents",
    },
  }));
}

function migratedDocument(procedure) {
  const createdAt = procedure.createdAt || procedure.updatedAt || new Date();
  const createdBy =
    procedure.createdBy || procedure.updatedBy || "biaws-migration";
  return {
    id: procedure.id,
    workspaceId: procedure.workspaceId,
    applicationId: procedure.applicationId ?? null,
    affectedComponentIds: procedure.affectedComponentIds || [],
    documentType: "procedure",
    schemaVersion: 1,
    title: procedure.title,
    summary: procedure.summary,
    markdown: procedure.procedure,
    status: "published",
    details: {},
    classification: procedure.classification || {
      primaryTaxonomyId: "",
      secondaryTaxonomyIds: [],
      tags: {},
    },
    source: { mode: "native", repositoryId: "", path: "" },
    collectionId: procedure.collectionId || "",
    references: [],
    definedAt: dateOnly(createdAt),
    lastReviewedAt: "",
    nextReviewAt: "",
    reviewedBy: "",
    attachments: migratedAttachments(procedure.attachments || []),
    createdAt,
    createdBy,
    updatedAt: procedure.updatedAt || createdAt,
    updatedBy: procedure.updatedBy || createdBy,
    migratedFrom: "procedure",
  };
}

function migratedCollection(collection) {
  return {
    id: collection.id,
    workspaceId: collection.workspaceId,
    resourceType: "documents",
    name: collection.name,
    nameKey: collection.nameKey || collection.name.toLocaleLowerCase("pt-BR"),
    parentId: collection.parentId || "",
    createdAt: collection.createdAt,
    createdBy: collection.createdBy || "biaws-migration",
    updatedAt: collection.updatedAt || collection.createdAt,
    updatedBy:
      collection.updatedBy || collection.createdBy || "biaws-migration",
    migratedFrom: "procedureCollection",
  };
}

function migratedPermissions(permissions = []) {
  return [
    ...new Set(
      permissions.map((permission) => PERMISSION_MAP[permission] || permission),
    ),
  ];
}

async function assertNoCollisions(db, procedures, collections) {
  const [documentCollisions, collectionIdCollisions] = await Promise.all([
    db.collection(COLLECTION_NAMES.DOCUMENTS).countDocuments({
      id: { $in: procedures.map(({ id }) => id) },
      documentType: { $ne: "procedure" },
    }),
    db.collection(COLLECTION_NAMES.RESOURCE_COLLECTIONS).countDocuments({
      id: { $in: collections.map(({ id }) => id) },
      resourceType: { $ne: "documents" },
    }),
  ]);
  if (documentCollisions || collectionIdCollisions) {
    throw new Error(
      `Migration aborted because of ID collisions: documents=${documentCollisions}, collections=${collectionIdCollisions}`,
    );
  }

  const existingCollections = await db
    .collection(COLLECTION_NAMES.RESOURCE_COLLECTIONS)
    .find({
      resourceType: "documents",
      id: { $nin: collections.map(({ id }) => id) },
    })
    .project({ workspaceId: 1, parentId: 1, nameKey: 1, name: 1 })
    .toArray();
  const existingKeys = new Set(
    existingCollections.map((collection) =>
      [
        collection.workspaceId,
        collection.parentId || "",
        collection.nameKey || collection.name.toLocaleLowerCase("pt-BR"),
      ].join("|"),
    ),
  );
  const nameCollisions = collections.filter((collection) =>
    existingKeys.has(
      [
        collection.workspaceId,
        collection.parentId || "",
        collection.nameKey || collection.name.toLocaleLowerCase("pt-BR"),
      ].join("|"),
    ),
  );
  if (nameCollisions.length) {
    throw new Error(
      `Migration aborted because document collection names conflict: ${nameCollisions.map(({ name }) => name).join(", ")}`,
    );
  }
}

async function migratePreferences(db) {
  let modified = 0;
  const preferences = db.collection(COLLECTION_NAMES.USER_PREFERENCES);
  for await (const preference of preferences.find({
    "collectionNavigation.procedures": { $exists: true },
  })) {
    const documents = preference.collectionNavigation?.documents || {};
    const procedures = preference.collectionNavigation?.procedures || {};
    const collapsedCollectionIds = [
      ...new Set([
        ...(documents.collapsedCollectionIds || []),
        ...(procedures.collapsedCollectionIds || []),
      ]),
    ];
    const result = await preferences.updateOne(
      { _id: preference._id },
      {
        $set: {
          "collectionNavigation.documents": {
            ...documents,
            collapsedCollectionIds,
            updatedAt: new Date(),
          },
        },
        $unset: { "collectionNavigation.procedures": "" },
      },
    );
    modified += result.modifiedCount;
  }
  return modified;
}

async function migrate() {
  const db = await getMongoDatabase();
  const procedures = await db.collection(LEGACY_PROCEDURES).find({}).toArray();
  const collections = await db
    .collection(LEGACY_COLLECTIONS)
    .find({})
    .toArray();
  const summary = {
    apply,
    database: db.databaseName,
    sourceProcedures: procedures.length,
    sourceCollections: collections.length,
    sourceAttachments: procedures.reduce(
      (total, procedure) => total + (procedure.attachments || []).length,
      0,
    ),
    runtimeLinks: await db
      .collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES)
      .aggregate([
        { $project: { count: { $size: { $ifNull: ["$procedureIds", []] } } } },
        { $group: { _id: null, count: { $sum: "$count" } } },
      ])
      .toArray()
      .then((items) => items[0]?.count || 0),
  };

  await assertNoCollisions(db, procedures, collections);
  if (!apply) {
    console.log(JSON.stringify(summary));
    return;
  }

  if (collections.length) {
    const result = await db
      .collection(COLLECTION_NAMES.RESOURCE_COLLECTIONS)
      .bulkWrite(
        collections.map((collection) => ({
          updateOne: {
            filter: { id: collection.id },
            update: { $setOnInsert: migratedCollection(collection) },
            upsert: true,
          },
        })),
      );
    summary.collectionsMigrated = result.upsertedCount;
  } else summary.collectionsMigrated = 0;

  if (procedures.length) {
    const documentResult = await db
      .collection(COLLECTION_NAMES.DOCUMENTS)
      .bulkWrite(
        procedures.map((procedure) => {
          const document = migratedDocument(procedure);
          return {
            updateOne: {
              filter: { id: document.id },
              update: { $setOnInsert: document },
              upsert: true,
            },
          };
        }),
      );
    summary.documentsMigrated = documentResult.upsertedCount;

    const revisionResult = await db
      .collection(COLLECTION_NAMES.KNOWLEDGE_REVISIONS)
      .bulkWrite(
        procedures.map((procedure) => {
          const document = migratedDocument(procedure);
          return {
            updateOne: {
              filter: {
                entityType: "document",
                entityId: document.id,
                revision: 1,
              },
              update: {
                $setOnInsert: {
                  id: `migration:procedure:${document.id}:revision:1`,
                  workspaceId: document.workspaceId,
                  applicationId: document.applicationId,
                  entityType: "document",
                  entityId: document.id,
                  revision: 1,
                  snapshot: document,
                  summary: "Procedimento migrado para documento",
                  createdAt: document.updatedAt,
                  createdBy: document.updatedBy,
                },
              },
              upsert: true,
            },
          };
        }),
      );
    summary.revisionsMigrated = revisionResult.upsertedCount;
  } else {
    summary.documentsMigrated = 0;
    summary.revisionsMigrated = 0;
  }

  const runtimes = db.collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES);
  let runtimesMigrated = 0;
  for await (const runtime of runtimes.find({
    $or: [
      { procedureIds: { $exists: true } },
      { procedureMarkdown: { $exists: true } },
    ],
  })) {
    const documentLinks = (runtime.procedureIds || []).map((documentId) => ({
      documentId,
      purpose: "operation",
    }));
    const result = await runtimes.updateOne(
      { _id: runtime._id },
      {
        $set: {
          documentLinks,
          operationalNotesMarkdown: runtime.procedureMarkdown || "",
        },
        $unset: { procedureIds: "", procedureMarkdown: "" },
      },
    );
    runtimesMigrated += result.modifiedCount;
  }
  summary.runtimesMigrated = runtimesMigrated;

  let permissionGroupsMigrated = 0;
  const permissionGroups = db.collection(COLLECTION_NAMES.PERMISSION_GROUPS);
  for await (const group of permissionGroups.find({
    permissions: { $elemMatch: { $regex: /^procedures\./u } },
  })) {
    const result = await permissionGroups.updateOne(
      { _id: group._id },
      {
        $set: {
          permissions: migratedPermissions(group.permissions),
          updatedAt: new Date(),
        },
      },
    );
    permissionGroupsMigrated += result.modifiedCount;
  }
  summary.permissionGroupsMigrated = permissionGroupsMigrated;
  summary.preferencesMigrated = await migratePreferences(db);

  const audit = db.collection(COLLECTION_NAMES.AUDIT_EVENTS);
  const [targetAudit, rootAudit] = await Promise.all([
    audit.updateMany(
      { "target.type": "procedure" },
      { $set: { "target.type": "document" } },
    ),
    audit.updateMany(
      { "root.type": "procedure" },
      { $set: { "root.type": "document" } },
    ),
  ]);
  const collectionAudit = await audit.updateMany(
    { "target.type": "procedure_collection" },
    { $set: { "target.type": "documents_collection" } },
  );
  const collectionRootAudit = await audit.updateMany(
    { "root.type": "procedure_collection" },
    { $set: { "root.type": "documents_collection" } },
  );
  summary.auditEventsMigrated =
    targetAudit.modifiedCount +
    rootAudit.modifiedCount +
    collectionAudit.modifiedCount +
    collectionRootAudit.modifiedCount;

  const [procedureDocuments, documentCollections, danglingRuntimeLinks] =
    await Promise.all([
      db.collection(COLLECTION_NAMES.DOCUMENTS).countDocuments({
        id: { $in: procedures.map(({ id }) => id) },
        documentType: "procedure",
      }),
      db.collection(COLLECTION_NAMES.RESOURCE_COLLECTIONS).countDocuments({
        id: { $in: collections.map(({ id }) => id) },
        resourceType: "documents",
      }),
      runtimes
        .aggregate([
          { $unwind: "$documentLinks" },
          {
            $lookup: {
              from: COLLECTION_NAMES.DOCUMENTS,
              localField: "documentLinks.documentId",
              foreignField: "id",
              as: "documents",
            },
          },
          { $match: { documents: { $size: 0 } } },
          { $count: "count" },
        ])
        .toArray()
        .then((items) => items[0]?.count || 0),
    ]);
  if (
    procedureDocuments !== procedures.length ||
    documentCollections !== collections.length ||
    danglingRuntimeLinks
  ) {
    throw new Error(
      `Migration validation failed: documents=${procedureDocuments}/${procedures.length}, collections=${documentCollections}/${collections.length}, danglingRuntimeLinks=${danglingRuntimeLinks}`,
    );
  }

  await Promise.all([
    db
      .collection(LEGACY_PROCEDURES)
      .drop()
      .catch((error) => {
        if (error.codeName !== "NamespaceNotFound") throw error;
      }),
    db
      .collection(LEGACY_COLLECTIONS)
      .drop()
      .catch((error) => {
        if (error.codeName !== "NamespaceNotFound") throw error;
      }),
  ]);
  summary.legacyCollectionsDropped = true;
  console.log(JSON.stringify(summary));
}

try {
  await migrate();
} finally {
  await closeMongoClient();
}
