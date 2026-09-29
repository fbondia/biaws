import { scopedFilter } from "../filters.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";

function utcPeriodStart(period, now = new Date()) {
  if (period === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = start.getUTCDay();
  start.setUTCDate(start.getUTCDate() - (day === 0 ? 6 : day - 1));
  return start;
}

export async function issuePeriodMetric(database, actor, config, now) {
  const period = config.period || "week";
  const count = await database
    .collection(COLLECTION_NAMES.ISSUES)
    .countDocuments({
      ...scopedFilter(actor, "issues.read"),
      "dates.receivedEmailAt": { $gte: utcPeriodStart(period, now), $lte: now },
    });
  return {
    kind: "stat",
    value: count,
    period,
    from: utcPeriodStart(period, now),
    to: now,
  };
}

export async function issueBreakdownMetric(database, actor, field) {
  const rows = await database
    .collection(COLLECTION_NAMES.ISSUES)
    .aggregate([
      {
        $match: {
          ...scopedFilter(actor, "issues.read"),
          status: { $ne: "closed" },
        },
      },
      { $group: { _id: `$${field}`, value: { $sum: 1 } } },
      { $sort: { value: -1, _id: 1 } },
      { $limit: 12 },
    ])
    .toArray();
  if (field === "applicationId") {
    const ids = rows.map(({ _id }) => _id).filter(Boolean);
    const applications = await database
      .collection(COLLECTION_NAMES.APPLICATIONS)
      .find({ workspaceId: actor.workspaceId, id: { $in: ids } })
      .project({ _id: 0, id: 1, name: 1 })
      .toArray();
    const names = new Map(applications.map(({ id, name }) => [id, name]));
    return {
      kind: "breakdown",
      items: rows.map((row) => ({
        key: row._id || "unknown",
        label: names.get(row._id) || "Sem aplicação",
        value: row.value,
      })),
    };
  }
  return {
    kind: "breakdown",
    items: rows.map((row) => ({
      key: row._id || "unknown",
      label: row._id || "Não informado",
      value: row.value,
    })),
  };
}
