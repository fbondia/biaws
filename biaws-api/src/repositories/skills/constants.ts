import { COLLECTION_NAMES } from "../../database/collectionNames.js";

export const SKILLS_COLLECTION = COLLECTION_NAMES.SKILLS;

export const SKILL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;

export const MAX_FILES = 200;

export const MAX_FILE_BYTES = 512 * 1024;

export const MAX_PACKAGE_BYTES = 2 * 1024 * 1024;
