import type { RepositoryQuery } from "../../types/http.js";
import { SKILLS_COLLECTION } from "./constants.js";
import { ensureIndexes } from "./indexes.js";
import { normalizeSkillPayload } from "./normalization.js";
import { workspaceId, createHttpError } from "./support.js";
import { getSkill } from "./queries.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { errorCode } from "../../helpers/error.js";

export async function publishSkill(payload: Record<string, unknown> = {}, query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(SKILLS_COLLECTION);
  await ensureIndexes(collection);
  const normalized = normalizeSkillPayload(payload);
  const current = await collection.findOne({
    workspaceId: workspaceId(query),
    skillId: normalized.skillId,
  });
  const now = new Date();
  try {
    await collection.insertOne({
      ...normalized,
      workspaceId: workspaceId(query),
      collectionId: query.forceRootCollection === true ? "" : String(current?.collectionId || ""),
      status: "published",
      createdAt: now,
      updatedAt: now,
    });
  } catch (error) {
    if (errorCode(error) === 11000) {
      throw createHttpError(409, `Skill version already exists: ${normalized.skillId}@${normalized.version}`);
    }
    throw error;
  }
  const published = await getSkill(normalized.skillId, normalized.version, query);
  if (!published.skill)
    throw new Error(`Published skill could not be read: ${normalized.skillId}@${normalized.version}`);
  return { ...published, skill: published.skill };
}

export async function deprecateSkill(
  skillId: string | string[],
  version: string | string[],
  query: RepositoryQuery = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const result = await db.collection(SKILLS_COLLECTION).updateOne(
    {
      workspaceId: workspaceId(query),
      skillId: String(skillId),
      version: String(version),
    },
    { $set: { status: "deprecated", updatedAt: new Date() } },
  );
  if (!result.matchedCount) {
    throw createHttpError(404, `Skill version not found: ${skillId}@${version}`);
  }
  return getSkill(skillId, version, query);
}

export async function moveSkillToCollection(
  skillId: string | string[],
  collectionId: string,
  query: RepositoryQuery = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const currentWorkspaceId = workspaceId(query);
  const result = await db.collection(SKILLS_COLLECTION).updateMany(
    { workspaceId: currentWorkspaceId, skillId: String(skillId) },
    {
      $set: {
        collectionId: String(collectionId || ""),
        updatedAt: new Date(),
      },
    },
  );
  if (!result.matchedCount) {
    throw createHttpError(404, `Skill not found: ${skillId}`);
  }
  return getSkill(skillId, undefined, query);
}
