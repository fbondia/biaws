import { PERMISSION_CATALOG } from "../../../../shared/index.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";

export const GROUPS_COLLECTION = COLLECTION_NAMES.PERMISSION_GROUPS;

export const USER_ACCESS_COLLECTION = COLLECTION_NAMES.WORKSPACE_MEMBERSHIPS;

export const MAX_SCOPE_APPLICATIONS = 250;

export const permissionIds = PERMISSION_CATALOG.map(({ id }) => id);

export const permissionsStartingWith = (...prefixes: string[]) =>
  permissionIds.filter((id) => prefixes.some((prefix: string) => id.startsWith(prefix)));
