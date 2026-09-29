import { ISSUES_COLLECTION } from "./constants.js";
import { buildExpandedIssueFilter } from "./filters.js";
import {
  aggregateByDate,
  aggregateByDateAndField,
  aggregateByField,
  aggregateByTaxonomy,
} from "./aggregation.js";
import { getSummaryOptions } from "../../helpers/query.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

export async function summarizeIssues(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(ISSUES_COLLECTION);
  const filter = await buildExpandedIssueFilter(db, query);
  const dayOptions = getSummaryOptions(query, "day");
  const weekOptions = getSummaryOptions(query, "week");
  const monthOptions = getSummaryOptions(query, "month");
  const yearOptions = getSummaryOptions(query, "year");
  const [total, byDate, byWeek, byMonth, byYear, byType, byStatus, byTaxonomy] =
    await Promise.all([
      collection.countDocuments(filter),
      aggregateByDate(collection, filter, dayOptions),
      aggregateByDate(collection, filter, weekOptions),
      aggregateByDateAndField(collection, filter, monthOptions, "type"),
      aggregateByDateAndField(collection, filter, yearOptions, "type"),
      aggregateByField(collection, filter, "type"),
      aggregateByField(collection, filter, "status"),
      aggregateByTaxonomy(collection, filter, dayOptions),
    ]);

  return {
    meta: {
      database: db.databaseName,
      collection: ISSUES_COLLECTION,
      total,
      dateField: dayOptions.dateField,
      timezone: dayOptions.timezone,
      filter,
    },
    byDate,
    byWeek,
    byMonth,
    byYear,
    byType,
    byStatus,
    byTaxonomy,
  };
}

function getAggregateDateOptions(query, groupBy) {
  if (groupBy === "date") return getSummaryOptions(query);
  if (["day", "week", "month", "year"].includes(groupBy)) {
    return getSummaryOptions(query, groupBy);
  }
  return null;
}

export async function aggregateIssues(query = {}, groupBy) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(ISSUES_COLLECTION);
  const filter = await buildExpandedIssueFilter(db, query);
  const summaryOptions = getAggregateDateOptions(query, groupBy);
  const items = summaryOptions
    ? await aggregateByDate(collection, filter, summaryOptions)
    : groupBy === "taxonomy"
      ? await aggregateByTaxonomy(collection, filter, getSummaryOptions(query))
      : await aggregateByField(collection, filter, groupBy);

  return {
    meta: {
      database: db.databaseName,
      collection: ISSUES_COLLECTION,
      groupBy,
      ...(summaryOptions
        ? {
            dateField: summaryOptions.dateField,
            interval: summaryOptions.interval,
            timezone: summaryOptions.timezone,
          }
        : {}),
      filter,
    },
    items,
  };
}
