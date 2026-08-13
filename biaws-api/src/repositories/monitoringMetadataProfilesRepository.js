import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { monitoringMetadataProfileCatalog } from "./monitoringMetadataProfiles.js";

export async function listMonitoringMetadataProfiles(workspaceId) {
  const database = await getMongoDatabase();
  const usage = await database
    .collection(COLLECTION_NAMES.RUNTIME_MONITORING_SIGNALS)
    .aggregate([
      {
        $match: {
          workspaceId: String(workspaceId),
          metadataProfile: { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$metadataProfile",
          observations: { $sum: 1 },
          lastObservedAt: { $max: "$observedAt" },
        },
      },
    ])
    .toArray();
  const usageById = new Map(usage.map((item) => [item._id, item]));
  return monitoringMetadataProfileCatalog().map((profile) => ({
    ...profile,
    status: "active",
    source: "system",
    usage: {
      observations: usageById.get(profile.id)?.observations || 0,
      lastObservedAt: usageById.get(profile.id)?.lastObservedAt || null,
    },
  }));
}
