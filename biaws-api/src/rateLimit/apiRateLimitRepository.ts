import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";

interface RateLimitDocument {
  _id: string;
  key: string;
  count: number;
  windowStart: Date;
  expiresAt: Date;
}

let indexesPromise: Promise<string>;

async function getCollection() {
  const database = await getMongoDatabase();
  const collection = database.collection<RateLimitDocument>(COLLECTION_NAMES.API_RATE_LIMITS);
  if (!indexesPromise) {
    indexesPromise = collection.createIndex(
      { expiresAt: 1 },
      { name: "api_rate_limit_expiration_ttl", expireAfterSeconds: 0 },
    );
  }
  await indexesPromise;
  return collection;
}

export async function consumeApiRateLimit({ key, windowSeconds }: { key: string; windowSeconds: number }) {
  const now = Date.now();
  const windowMilliseconds = windowSeconds * 1_000;
  const windowStart = Math.floor(now / windowMilliseconds) * windowMilliseconds;
  const expiresAt = new Date(windowStart + windowMilliseconds);
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { _id: `${key}:${windowStart}` },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        key,
        windowStart: new Date(windowStart),
        expiresAt,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  return { count: result?.count ?? 0, expiresAt };
}
