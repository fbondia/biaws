export {
  normalizeSecretIdentifier,
  normalizeSecretPayload,
  publicSecret,
  currentSecretVersion,
} from "./normalization.js";

export { listSecrets, getSecretDocument } from "./queries.js";

export {
  createSecretDocument,
  createPendingSecretDocument,
  updateSecretDocument,
  archiveSecretDocument,
  restoreSecretDocument,
  deleteSecretDocument,
  moveSecretDocumentToCollection,
} from "./mutations.js";

export { addSecretVersion } from "./versions.js";
