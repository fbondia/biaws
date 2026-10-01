import type { Document, Filter } from "mongodb";

import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { collectTaxonomyIds, filterTaxonomyForApplication } from "../../helpers/taxonomy.js";
import type { TaxonomyNode } from "../../helpers/taxonomy.js";
import { textValue } from "../../helpers/text.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import type { RepositoryQuery } from "../../types/http.js";

const ACTIVE_TAXONOMY_KEY = "biaws";
const ACTIVE_STATUS = "active";

const TAXONOMY_REFERENCE_TARGETS = [
  { collection: COLLECTION_NAMES.ISSUES, resultKey: "issues" },
  { collection: COLLECTION_NAMES.DOCUMENTS, resultKey: "documents" },
] as const;

type TransferResultKey = (typeof TAXONOMY_REFERENCE_TARGETS)[number]["resultKey"];

function createHttpError(statusCode: number, code: string, message: string) {
  return Object.assign(new Error(message), { code, statusCode });
}

function workspaceId(query: RepositoryQuery = {}) {
  return String(query.authorizationScope?.workspaceId || query.workspaceId || "");
}

function taxonomyReferenceFilter(workspace: string, taxonomyId: string): Filter<Document> {
  return {
    workspaceId: workspace,
    $or: [{ "classification.primaryTaxonomyId": taxonomyId }, { "classification.secondaryTaxonomyIds": taxonomyId }],
  };
}

export function transferTaxonomyClassification(
  classification: Record<string, unknown> = {},
  sourceTaxonomyId: string,
  destinationTaxonomyId: string,
) {
  const currentPrimary = textValue(classification.primaryTaxonomyId || "").trim();
  const primaryTaxonomyId = currentPrimary === sourceTaxonomyId ? destinationTaxonomyId : currentPrimary;
  const currentSecondary = Array.isArray(classification.secondaryTaxonomyIds)
    ? classification.secondaryTaxonomyIds.map((id) => textValue(id || "").trim()).filter(Boolean)
    : [];
  const secondaryTaxonomyIds = [
    ...new Set(currentSecondary.map((id) => (id === sourceTaxonomyId ? destinationTaxonomyId : id))),
  ].filter((id) => id !== primaryTaxonomyId);

  return {
    ...classification,
    primaryTaxonomyId,
    secondaryTaxonomyIds,
  };
}

function transferPipeline(sourceTaxonomyId: string, destinationTaxonomyId: string, updatedBy: string, now: Date) {
  const nextPrimary = {
    $cond: [
      { $eq: ["$classification.primaryTaxonomyId", sourceTaxonomyId] },
      destinationTaxonomyId,
      { $ifNull: ["$classification.primaryTaxonomyId", ""] },
    ],
  };
  const nextSecondary = {
    $filter: {
      input: {
        $setUnion: [
          {
            $map: {
              input: { $ifNull: ["$classification.secondaryTaxonomyIds", []] },
              as: "taxonomyId",
              in: {
                $cond: [{ $eq: ["$$taxonomyId", sourceTaxonomyId] }, destinationTaxonomyId, "$$taxonomyId"],
              },
            },
          },
          [],
        ],
      },
      as: "taxonomyId",
      cond: {
        $and: [{ $ne: ["$$taxonomyId", ""] }, { $ne: ["$$taxonomyId", nextPrimary] }],
      },
    },
  };

  return [
    {
      $set: {
        classification: {
          $mergeObjects: [
            { $ifNull: ["$classification", {}] },
            {
              primaryTaxonomyId: nextPrimary,
              secondaryTaxonomyIds: nextSecondary,
              updatedAt: now,
              updatedBy,
            },
          ],
        },
        updatedAt: now,
        updatedBy,
      },
    },
  ];
}

async function validateTransferScope(
  db: Awaited<ReturnType<typeof getMongoDatabase>>,
  workspace: string,
  taxonomy: TaxonomyNode[],
  sourceTaxonomyId: string,
  destinationTaxonomyId: string,
) {
  const applicationIds = new Set<string>();
  for (const { collection } of TAXONOMY_REFERENCE_TARGETS) {
    const references = db.collection(collection);
    const filter = taxonomyReferenceFilter(workspace, sourceTaxonomyId);
    const ids = await references.distinct("applicationId", filter);
    for (const id of ids) applicationIds.add(textValue(id || "").trim());
    if (await references.countDocuments({ ...filter, applicationId: null }, { limit: 1 })) {
      applicationIds.add("");
    }
  }

  const incompatibleApplicationIds = [...applicationIds].filter((applicationId) => {
    const availableIds = collectTaxonomyIds(filterTaxonomyForApplication(taxonomy, applicationId));
    return !availableIds.includes(destinationTaxonomyId);
  });
  if (incompatibleApplicationIds.length) {
    const labels = incompatibleApplicationIds.map((id) => id || "workspace").join(", ");
    throw createHttpError(
      422,
      "TAXONOMY_TRANSFER_SCOPE_MISMATCH",
      `O nó de destino não está disponível para todos os registros vinculados. Escopos incompatíveis: ${labels}`,
    );
  }
}

export async function transferTaxonomyReferences(payload: Record<string, unknown> = {}, query: RepositoryQuery = {}) {
  const sourceTaxonomyId = textValue(payload.sourceTaxonomyId || "").trim();
  const destinationTaxonomyId = textValue(payload.destinationTaxonomyId || "").trim();
  if (!sourceTaxonomyId || !destinationTaxonomyId) {
    throw createHttpError(
      422,
      "INVALID_TAXONOMY_TRANSFER",
      "sourceTaxonomyId e destinationTaxonomyId são obrigatórios",
    );
  }
  if (sourceTaxonomyId === destinationTaxonomyId) {
    throw createHttpError(422, "INVALID_TAXONOMY_TRANSFER", "Os nós de origem e destino devem ser diferentes");
  }

  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const workspace = workspaceId(query);
  const taxonomyPackage = await db.collection<{ taxonomy?: TaxonomyNode[] }>(COLLECTION_NAMES.TAXONOMIES).findOne({
    workspaceId: workspace,
    key: ACTIVE_TAXONOMY_KEY,
    status: ACTIVE_STATUS,
  });
  const taxonomy = taxonomyPackage?.taxonomy || [];
  const taxonomyIds = new Set(collectTaxonomyIds(taxonomy));
  const missingIds = [sourceTaxonomyId, destinationTaxonomyId].filter((id) => !taxonomyIds.has(id));
  if (missingIds.length) {
    throw createHttpError(
      422,
      "INVALID_TAXONOMY_TRANSFER",
      `Nós de taxonomia não encontrados: ${missingIds.join(", ")}`,
    );
  }

  await validateTransferScope(db, workspace, taxonomy, sourceTaxonomyId, destinationTaxonomyId);

  const now = new Date();
  const updatedBy = textValue(payload.updatedBy || "biaws-ui").trim();
  const results = {} as Record<TransferResultKey, { matched: number; modified: number }>;
  for (const target of TAXONOMY_REFERENCE_TARGETS) {
    const result = await db
      .collection(target.collection)
      .updateMany(
        taxonomyReferenceFilter(workspace, sourceTaxonomyId),
        transferPipeline(sourceTaxonomyId, destinationTaxonomyId, updatedBy, now),
      );
    results[target.resultKey] = {
      matched: result.matchedCount,
      modified: result.modifiedCount,
    };
  }

  const modified = Object.values(results).reduce((total, result) => total + result.modified, 0);
  return {
    transfer: {
      sourceTaxonomyId,
      destinationTaxonomyId,
      results,
      modified,
      transferredAt: now,
      transferredBy: updatedBy,
    },
  };
}
