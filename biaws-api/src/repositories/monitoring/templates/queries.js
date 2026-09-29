import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";
import { pagination } from "../../shared/topology/filters.js";
import {
  publicTemplate,
  requireTemplate,
  templateCollection,
} from "./storage.js";

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
