import { MongoClient } from "mongodb";

let clientPromise;

function readEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }
  return undefined;
}

function getDatabaseNameFromUri(uri) {
  try {
    const url = new URL(uri);
    const pathName = decodeURIComponent(url.pathname || "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    return pathName || undefined;
  } catch {
    return undefined;
  }
}

export function resolveMongoUri() {
  const uri = readEnv("MONGO_URI", "MONGODB_URI", "MONGODB_CONNECTION");

  if (!uri) {
    throw new Error(
      "Missing MongoDB connection string. Set MONGO_URI or MONGODB_CONNECTION in biaws/.env.",
    );
  }

  return uri;
}

export function resolveDatabaseName(options = {}) {
  const uri = resolveMongoUri();
  const fromOption = options.db || options.database;
  const fromEnv = readEnv(
    "MONGO_DB",
    "MONGODB_DB",
    "MONGODB_DATABASE",
    "MONGO_DATABASE",
    "DB_NAME",
  );
  const databaseName = String(
    fromOption ?? fromEnv ?? getDatabaseNameFromUri(uri) ?? "",
  ).trim();

  if (!databaseName) {
    throw new Error(
      "Missing MongoDB database. Set MONGO_DB/MONGODB_DATABASE, include it in MONGO_URI, or pass db.",
    );
  }

  return databaseName;
}

export async function getMongoClient() {
  if (!clientPromise) {
    const client = new MongoClient(resolveMongoUri());
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getMongoDatabase(options = {}) {
  const client = await getMongoClient();
  return client.db(resolveDatabaseName(options));
}

export async function closeMongoClient() {
  if (!clientPromise) return;

  const client = await clientPromise;
  clientPromise = undefined;
  await client.close();
}
