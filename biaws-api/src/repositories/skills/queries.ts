type SkillVersionQuery = string | ParsedQs | (string | ParsedQs)[] | undefined;
import { textValue } from "../../helpers/text.js";
import type { RepositoryQuery } from "../../types/http.js";
import type { SkillDocument, PublicSkillDocument } from "../../types/skills.js";
import { SKILLS_COLLECTION } from "./constants.js";
import { ensureIndexes } from "./indexes.js";
import { workspaceId } from "./support.js";
import { compareSemver, normalizeDocument, withoutFileContents } from "./normalization.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { ParsedQs } from "qs";

export async function listSkills(query: RepositoryQuery = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection<SkillDocument>(SKILLS_COLLECTION);
  await ensureIndexes(collection);
  const documents = await collection
    .find({
      workspaceId: workspaceId(query),
      ...(query.includeDeprecated === "true" ? {} : { status: "published" }),
    })
    .project({ files: 0 })
    .toArray();
  const grouped = new Map();
  for (const document of documents) {
    const current = grouped.get(document.skillId);
    if (!current || compareSemver(document.version, current.latestVersion) > 0) {
      grouped.set(document.skillId, {
        skillId: document.skillId,
        name: document.name,
        description: document.description,
        collectionId: String(document.collectionId || ""),
        latestVersion: document.version,
        status: document.status,
        packageSha256: document.packageSha256,
        updatedAt: document.updatedAt,
        versions: [],
      });
    }
  }
  for (const document of documents) {
    grouped.get(document.skillId)?.versions.push({
      version: document.version,
      status: document.status,
      packageSha256: document.packageSha256,
      createdAt: document.createdAt,
    });
  }
  const items = [...grouped.values()]
    .map((item) => ({
      ...item,
      versions: item.versions.sort((a: { version: string }, b: { version: string }) =>
        compareSemver(b.version, a.version),
      ),
    }))
    .sort((a, b) => a.skillId.localeCompare(b.skillId));
  return {
    meta: {
      database: db.databaseName,
      collection: SKILLS_COLLECTION,
      total: items.length,
    },
    items,
  };
}

export function getSkill(
  skillId: string | string[],
  version: SkillVersionQuery,
  query: RepositoryQuery,
  options: RepositoryQuery & { includeContents: true },
): Promise<{
  meta: { database: string; collection: string };
  skill: PublicSkillDocument | null;
}>;
export function getSkill(
  skillId: string | string[],
  version: SkillVersionQuery,
  query?: RepositoryQuery,
  options?: RepositoryQuery,
): Promise<{
  meta: { database: string; collection: string };
  skill: ReturnType<typeof withoutFileContents> | PublicSkillDocument;
}>;
export async function getSkill(
  skillId: string | string[],
  version: SkillVersionQuery,
  query: RepositoryQuery = {},
  options: RepositoryQuery = {},
): Promise<{
  meta: { database: string; collection: string };
  skill: PublicSkillDocument | ReturnType<typeof withoutFileContents>;
}> {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection<SkillDocument>(SKILLS_COLLECTION);
  await ensureIndexes(collection);
  let document;
  if (version) {
    document = await collection.findOne({
      workspaceId: workspaceId(query),
      skillId: String(skillId),
      version: textValue(version),
    });
  } else {
    const candidates = await collection
      .find({
        skillId: String(skillId),
        workspaceId: workspaceId(query),
        ...(query.includeDeprecated === "true" ? {} : { status: "published" }),
      })
      .toArray();
    document = candidates.toSorted((a, b) => compareSemver(b.version, a.version))[0];
  }
  const selectedDocument = document ?? null;
  const skill = options.includeContents ? normalizeDocument(selectedDocument) : withoutFileContents(selectedDocument);
  return {
    meta: { database: db.databaseName, collection: SKILLS_COLLECTION },
    skill,
  };
}
