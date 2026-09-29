import { COLLECTION_NAMES } from "../../database/collectionNames.js";

export const RESOURCE_COLLECTION_TYPES = Object.freeze([
  "applications",
  "documents",
  "demands",
  "secrets",
  "skills",
  "servers",
]);

export const RESOURCE_CONFIG = Object.freeze({
  applications: {
    collection: COLLECTION_NAMES.APPLICATIONS,
    label: "aplicações",
  },
  documents: { collection: COLLECTION_NAMES.DOCUMENTS, label: "documentos" },
  demands: { collection: COLLECTION_NAMES.REQUESTS, label: "melhorias" },
  secrets: { collection: COLLECTION_NAMES.SECRETS, label: "segredos" },
  skills: { collection: COLLECTION_NAMES.SKILLS, label: "skills" },
  servers: { collection: COLLECTION_NAMES.SERVERS, label: "servidores" },
});

export const APPLICATION_SCOPED_COLLECTION_TYPES = new Set(["documents", "demands"]);
