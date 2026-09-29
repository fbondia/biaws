import type { GroupDocument } from "../../types/catalog.js";
import { GROUPS_COLLECTION, USER_ACCESS_COLLECTION } from "./constants.js";
import { upsertInitialPermissionGroups } from "./seeds.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { ensureDefaultWorkspace } from "../catalog/workspaces/bootstrap.js";

export async function getCollections() {
  const db = await getMongoDatabase();
  const groups = db.collection<GroupDocument>(GROUPS_COLLECTION);
  const userAccess = db.collection(USER_ACCESS_COLLECTION);
  const users = db.collection<{ _id: string | import("mongodb").ObjectId }>(
    COLLECTION_NAMES.AUTH_USERS,
  );
  const workspace = await ensureDefaultWorkspace();

  const groupIndexes = await groups.indexes().catch(() => []);
  const accessIndexes = await userAccess.indexes().catch(() => []);
  const legacyNameIndex = groupIndexes.find(
    ({ name, key, unique }) =>
      unique && name === "normalizedName_1" && key?.normalizedName === 1,
  );
  if (legacyNameIndex?.name) await groups.dropIndex(legacyNameIndex.name);
  const legacyUserIndex = accessIndexes.find(
    ({ name, key, unique }) =>
      unique && name === "userId_1" && key?.userId === 1,
  );
  if (legacyUserIndex?.name) await userAccess.dropIndex(legacyUserIndex.name);
  await Promise.all([
    groups.createIndex(
      { workspaceId: 1, normalizedName: 1 },
      { unique: true, name: "workspace_group_name_unique" },
    ),
    groups.createIndex(
      { workspaceId: 1, identifier: 1 },
      {
        unique: true,
        name: "workspace_group_identifier_unique",
        partialFilterExpression: { identifier: { $type: "string" } },
      },
    ),
    groups.createIndex({ workspaceId: 1, active: 1, name: 1 }),
    userAccess.createIndex(
      { userId: 1, workspaceId: 1 },
      { unique: true, name: "user_workspace_access_unique" },
    ),
    userAccess.createIndex({ workspaceId: 1, groupIds: 1 }),
  ]);

  await upsertInitialPermissionGroups(groups, workspace);

  return { db, groups, userAccess, users, defaultWorkspace: workspace };
}
