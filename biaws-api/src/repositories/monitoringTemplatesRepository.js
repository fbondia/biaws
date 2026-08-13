import { randomUUID } from "node:crypto";

import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import {
  evaluateMonitoringTemplate,
  normalizeMonitoringTemplateDefinition,
  sanitizeMonitoringTemplateSample,
} from "./monitoringTemplateEvaluator.js";
import {
  actorId,
  assertAllowedFields,
  createCatalogError,
  pagination,
} from "./topologyRepositorySupport.js";
import {
  normalizeTemplateInput,
  publicTemplate,
  requireTemplate,
  templateCollection,
} from "./monitoringTemplatesStorage.js";
import {
  isUnifiedMonitoringTemplateDefinition,
  unifiedMonitoringTemplateSnapshot,
} from "./monitoringTemplateUnifiedDefinition.js";
import { evaluateUnifiedMonitoringTemplate } from "./monitoringUnifiedTemplateEvaluator.js";

export async function createMonitoringTemplate(payload, actor) {
  const normalized = normalizeTemplateInput(payload);
  const now = new Date();
  const document = {
    id: randomUUID(),
    workspaceId: actor.workspaceId,
    ...normalized,
    version: "1",
    versionNumber: 1,
    status: "draft",
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
  try {
    await (await templateCollection()).insertOne(document);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    throw createCatalogError(
      409,
      "MONITORING_TEMPLATE_CONCURRENT_UPDATE",
      "Template changed concurrently; reload and try again",
    );
  }
  return publicTemplate(document);
}

export async function createMonitoringTemplateVersion(id, payload, actor) {
  const current = await requireTemplate(id, null, actor.workspaceId);
  const normalized = normalizeTemplateInput(payload, current);
  const now = new Date();
  const versionNumber = current.versionNumber + 1;
  const document = {
    id: current.id,
    workspaceId: current.workspaceId,
    ...normalized,
    version: String(versionNumber),
    versionNumber,
    status: "draft",
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
    derivedFromVersion: current.version,
  };
  try {
    await (await templateCollection()).insertOne(document);
  } catch (error) {
    if (error?.code !== 11000) throw error;
    throw createCatalogError(
      409,
      "MONITORING_TEMPLATE_CONCURRENT_UPDATE",
      "Template changed concurrently; reload and try again",
    );
  }
  return publicTemplate(document);
}

export async function listMonitoringTemplates(query = {}) {
  const { page, limit, skip } = pagination(query);
  const collection = await templateCollection();
  const match = {
    workspaceId: String(query.workspaceId),
    status: { $ne: "archived" },
  };
  if (query.status) match.status = String(query.status);
  const pipeline = [
    { $match: match },
    { $sort: { versionNumber: -1 } },
    {
      $group: {
        _id: "$id",
        latest: { $first: "$$ROOT" },
        versions: { $push: "$$ROOT" },
      },
    },
    { $sort: { "latest.nameKey": 1, _id: 1 } },
    { $skip: skip },
    { $limit: limit },
  ];
  const [groups, totalResult] = await Promise.all([
    collection.aggregate(pipeline).toArray(),
    collection
      .aggregate([
        { $match: match },
        { $group: { _id: "$id" } },
        { $count: "total" },
      ])
      .toArray(),
  ]);
  return {
    meta: { total: totalResult[0]?.total || 0, page, limit },
    items: groups.map(({ latest, versions }) => ({
      ...publicTemplate(latest),
      versions: versions.map(publicTemplate),
    })),
  };
}

export async function getMonitoringTemplate(id, query = {}) {
  const template = await requireTemplate(id, query.version, query.workspaceId);
  const versions = await (
    await templateCollection()
  )
    .find({
      id: template.id,
      workspaceId: template.workspaceId,
      status: { $ne: "archived" },
    })
    .sort({ versionNumber: -1 })
    .toArray();
  return {
    ...publicTemplate(template),
    versions: versions.map(publicTemplate),
  };
}

export async function setMonitoringTemplateStatus(id, version, status, actor) {
  if (!["active", "inactive"].includes(status)) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_TEMPLATE",
      "Template status must be active or inactive",
    );
  }
  const template = await requireTemplate(id, version, actor.workspaceId);
  const definition = normalizeMonitoringTemplateDefinition(template.definition);
  if (
    status === "active" &&
    isUnifiedMonitoringTemplateDefinition(definition)
  ) {
    await evaluateUnifiedMonitoringTemplate(
      definition,
      definition.input.sample,
    );
  }
  const now = new Date();
  const collection = await templateCollection();
  if (status === "active") {
    await collection.updateMany(
      {
        id: template.id,
        workspaceId: template.workspaceId,
        status: "active",
        version: { $ne: template.version },
      },
      {
        $set: { status: "inactive", updatedAt: now, updatedBy: actorId(actor) },
      },
    );
  }
  const result = await collection.findOneAndUpdate(
    {
      id: template.id,
      workspaceId: template.workspaceId,
      version: template.version,
      status: { $ne: "archived" },
    },
    { $set: { status, updatedAt: now, updatedBy: actorId(actor) } },
    { returnDocument: "after" },
  );
  return publicTemplate(result);
}

export async function monitoringTemplateUsage(id, version, workspaceId) {
  const template = await requireTemplate(id, version, workspaceId);
  const database = await getMongoDatabase();
  const ref = {
    "templateRef.id": template.id,
    "templateRef.version": template.version,
    workspaceId: template.workspaceId,
  };
  const [monitors, activeMonitors, observations] = await Promise.all([
    database
      .collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS)
      .countDocuments(ref),
    database
      .collection(COLLECTION_NAMES.RUNTIME_ACTIVE_MONITORS)
      .countDocuments({ ...ref, archivedAt: { $exists: false } }),
    database
      .collection(COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS)
      .countDocuments(ref),
  ]);
  return {
    templateRef: { id: template.id, version: template.version },
    monitors,
    activeMonitors,
    observations,
    inUse: monitors > 0 || observations > 0,
  };
}

export async function archiveMonitoringTemplate(id, version, actor) {
  const usage = await monitoringTemplateUsage(id, version, actor.workspaceId);
  if (usage.inUse) {
    throw createCatalogError(
      409,
      "MONITORING_TEMPLATE_IN_USE",
      "Template version is associated with monitors or historical observations",
    );
  }
  const now = new Date();
  const result = await (
    await templateCollection()
  ).findOneAndUpdate(
    {
      id: String(id),
      version: String(version),
      workspaceId: actor.workspaceId,
      status: { $ne: "archived" },
    },
    {
      $set: {
        status: "archived",
        archivedAt: now,
        archivedBy: actorId(actor),
        updatedAt: now,
        updatedBy: actorId(actor),
      },
    },
    { returnDocument: "after" },
  );
  if (!result)
    throw createCatalogError(
      404,
      "MONITORING_TEMPLATE_NOT_FOUND",
      "Monitoring template not found",
    );
  return publicTemplate(result);
}

export async function previewMonitoringTemplate(payload = {}) {
  assertAllowedFields(
    payload,
    ["definition", "sample"],
    "monitoring template preview",
  );
  const definition = normalizeMonitoringTemplateDefinition(payload.definition);
  const sample = sanitizeMonitoringTemplateSample(
    payload.sample ?? definition.input?.sample ?? {},
  );
  if (isUnifiedMonitoringTemplateDefinition(definition)) {
    return evaluateUnifiedMonitoringTemplate(definition, sample);
  }
  return evaluateMonitoringTemplate(definition, sample);
}

export async function evaluateMonitoringTemplateReference(
  templateRef,
  sample,
  workspaceId,
) {
  if (!templateRef) return null;
  const template = await requireTemplate(
    templateRef.id,
    templateRef.version,
    workspaceId,
  );
  const templateSnapshot = {
    id: template.id,
    version: template.version,
    name: template.name,
    description: template.description,
    definition: template.definition,
    ...unifiedMonitoringTemplateSnapshot(template),
  };
  let evaluation;
  try {
    evaluation = isUnifiedMonitoringTemplateDefinition(template.definition)
      ? await evaluateUnifiedMonitoringTemplate(
          template.definition,
          sample?.evidence ?? sample,
        )
      : evaluateMonitoringTemplate(template.definition, sample);
  } catch (error) {
    error.templateRef = { id: template.id, version: template.version };
    error.templateSnapshot = templateSnapshot;
    throw error;
  }
  return {
    ...evaluation,
    templateRef: { id: template.id, version: template.version },
    templateSnapshot,
  };
}
