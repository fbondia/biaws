import type { Db, ObjectId } from "mongodb";
import type { Journey } from "../../types/requests.js";
import { JOURNEY_PERIODS_COLLECTION } from "./constants.js";
import { createHttpError, isMonthString, monthKeysBetween, readNumber, readString } from "./support.js";

export function normalizeJourneyPeriods(payloadJourneyPeriods: unknown = [], startDate = "", endDate = "") {
  const journeysByMonth = new Map<string, Partial<Journey>>();

  if (Array.isArray(payloadJourneyPeriods)) {
    for (const [index, item] of payloadJourneyPeriods.entries()) {
      if (!isMonthString(item?.month)) {
        throw createHttpError(422, `Invalid request payload: journeys[${index}].month must be YYYY-MM`);
      }

      const plannedJourneys = readNumber(
        item.plannedJourneys ?? item.predictedJourneys ?? item.journeys,
        `journeys[${index}].plannedJourneys`,
      );

      journeysByMonth.set(item.month, {
        plannedJourneys,
        executedJourneys: readNumber(
          item.executedJourneys ?? item.billedJourneys,
          `journeys[${index}].executedJourneys`,
        ),
        comment: readString(item.comment),
      });
    }
  }

  return monthKeysBetween(startDate, endDate).map((month) => {
    const current = journeysByMonth.get(month) || {};

    return {
      month,
      plannedJourneys: current.plannedJourneys || 0,
      executedJourneys: current.executedJourneys || 0,
      comment: current.comment || "",
    };
  });
}

export async function readJourneyPeriods(db: Db, requestIds: ObjectId[]) {
  if (!requestIds.length) return new Map<string, Journey[]>();

  const rows = await db
    .collection(JOURNEY_PERIODS_COLLECTION)
    .find({ requestId: { $in: requestIds } })
    .sort({ month: 1 })
    .toArray();
  const byRequestId = new Map<string, Journey[]>();

  for (const row of rows) {
    const key = row.requestId?.toString?.() ?? String(row.requestId);
    const items = byRequestId.get(key) || [];
    items.push({
      month: row.month,
      plannedJourneys: Number(row.plannedJourneys ?? row.journeys) || 0,
      executedJourneys: Number(row.executedJourneys ?? row.billedJourneys) || 0,
      comment: row.comment || "",
    });
    byRequestId.set(key, items);
  }

  return byRequestId;
}

export async function syncJourneyPeriods(db: Db, requestId: ObjectId, journeys: Journey[], now: Date) {
  const journeyPeriodsCollection = db.collection(JOURNEY_PERIODS_COLLECTION);
  await journeyPeriodsCollection.deleteMany({ requestId });

  if (!journeys.length) return;

  await journeyPeriodsCollection.insertMany(
    journeys.map((item) => ({
      requestId,
      month: item.month,
      plannedJourneys: item.plannedJourneys,
      executedJourneys: item.executedJourneys,
      comment: item.comment || "",
      createdAt: now,
      updatedAt: now,
    })),
  );
}
