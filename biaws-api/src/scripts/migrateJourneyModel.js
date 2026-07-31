#!/usr/bin/env node

import "../config.js";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { closeMongoClient, getMongoDatabase } from "../helpers/mongoClient.js";

const LEGACY_COLLECTION = "requestBillingPeriods";
const JOURNEY_COLLECTION = COLLECTION_NAMES.REQUEST_JOURNEY_PERIODS;
const TERMINOLOGY_GROUPS = [
  {
    id: "incident-management",
    name: "Gestão de chamados",
    description: "Gerenciamento completo de chamados e seus anexos.",
  },
  {
    id: "demand-management",
    name: "Gestão de melhorias",
    description: "Gerenciamento completo de melhorias, tarefas e anexos.",
  },
  {
    id: "support",
    name: "Chamados",
    description: "Consulta, comentários e atualização de status de chamados.",
  },
  {
    id: "improvement-development",
    name: "Desenvolvimento de melhorias",
    description:
      "Leitura de melhorias e colaboração em tarefas e especificações.",
  },
];
const TERMINOLOGY_OPTION_LISTS = [
  {
    key: "issue.type",
    legacyName: "Tipos de issues",
    legacyDescription:
      "Tipos disponíveis para cadastro, importação e filtro de issues.",
    name: "Tipos de chamados",
    description:
      "Tipos disponíveis para cadastro, importação e filtro de chamados.",
  },
  {
    key: "issue.status",
    legacyName: "Status de issues",
    legacyDescription:
      "Situações disponíveis para cadastro, edição e filtro de issues.",
    name: "Status de chamados",
    description:
      "Situações disponíveis para cadastro, edição e filtro de chamados.",
  },
  {
    key: "demand.status",
    legacyName: "Status de demandas",
    legacyDescription: "Situações disponíveis para uma demanda.",
    name: "Status de melhorias",
    description: "Situações disponíveis para uma melhoria.",
  },
  {
    key: "demand.task-status",
    legacyName: "Status de tarefas",
    legacyDescription: "Situações disponíveis para tarefas de demandas.",
    name: "Status de tarefas",
    description: "Situações disponíveis para tarefas de melhorias.",
  },
  {
    key: "demand.checklist",
    legacyName: "Checklist de demandas",
    legacyDescription:
      "Etapas criadas automaticamente no checklist de novas demandas.",
    name: "Checklist de melhorias",
    description:
      "Etapas criadas automaticamente no checklist de novas melhorias.",
  },
];

async function collectionExists(db, name) {
  return db.listCollections({ name }, { nameOnly: true }).hasNext();
}

async function migrateTerminology(db) {
  const now = new Date();
  const groupResult = await db
    .collection(COLLECTION_NAMES.PERMISSION_GROUPS)
    .bulkWrite(
      TERMINOLOGY_GROUPS.map(({ id, name, description }) => ({
        updateOne: {
          filter: {
            _id: id,
            system: true,
            $or: [
              { name: { $ne: name } },
              { description: { $ne: description } },
            ],
          },
          update: {
            $set: {
              name,
              normalizedName: name.toLocaleLowerCase("pt-BR"),
              description,
              updatedAt: now,
            },
          },
        },
      })),
    );
  const optionListResult = await db
    .collection(COLLECTION_NAMES.OPTION_LISTS)
    .bulkWrite(
      TERMINOLOGY_OPTION_LISTS.map(
        ({ key, legacyName, legacyDescription, name, description }) => ({
          updateOne: {
            filter: { key, name: legacyName, description: legacyDescription },
            update: { $set: { name, description, updatedAt: now } },
          },
        }),
      ),
    );

  return {
    permissionGroups: groupResult.modifiedCount,
    optionLists: optionListResult.modifiedCount,
  };
}

async function migrate() {
  const db = await getMongoDatabase();
  const legacyExists = await collectionExists(db, LEGACY_COLLECTION);
  const journeyExists = await collectionExists(db, JOURNEY_COLLECTION);

  if (legacyExists && journeyExists) {
    throw new Error(
      `Migration requires a single source collection, but both ${LEGACY_COLLECTION} and ${JOURNEY_COLLECTION} exist.`,
    );
  }

  if (legacyExists) {
    await db.collection(LEGACY_COLLECTION).rename(JOURNEY_COLLECTION);
  }

  const collection = db.collection(JOURNEY_COLLECTION);
  const result = await collection.updateMany({}, [
    {
      $set: {
        plannedJourneys: { $ifNull: ["$plannedJourneys", "$journeys"] },
        executedJourneys: {
          $ifNull: ["$executedJourneys", "$billedJourneys"],
        },
      },
    },
    { $unset: ["billedJourneys", "journeys"] },
  ]);

  await collection.createIndex({ requestId: 1, month: 1 }, { unique: true });

  const documents = await collection.countDocuments();
  const terminology = await migrateTerminology(db);
  console.log(
    JSON.stringify({
      database: db.databaseName,
      collection: JOURNEY_COLLECTION,
      renamedCollection: legacyExists,
      matchedDocuments: result.matchedCount,
      modifiedDocuments: result.modifiedCount,
      documents,
      terminology,
    }),
  );
}

try {
  await migrate();
} finally {
  await closeMongoClient();
}
