import { monitoringTemplateUsage } from "./queries.js";
import { randomUUID } from "node:crypto";
import { normalizeMonitoringTemplateDefinition } from "./legacyEvaluator.js";
import { actorId } from "../../shared/topology/lifecycle.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import {
  normalizeTemplateInput,
  publicTemplate,
  requireTemplate,
  templateCollection,
} from "./storage.js";
import { isUnifiedMonitoringTemplateDefinition } from "./unifiedDefinition.js";
import { evaluateUnifiedMonitoringTemplate } from "./unifiedEvaluator.js";

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
