export { DOCUMENT_TYPES, documentTypeConfig } from "./types.js";

export { documentReplicationPayload, normalizeDocumentPayload, restoredDocumentStatus } from "./normalization.js";

export { listDocuments, getDocument, getDocumentByIdentifier } from "./queries.js";

export {
  createDocument,
  updateDocument,
  archiveDocument,
  restoreDocument,
  deleteDocument,
  moveDocument,
} from "./mutations.js";

export { listDocumentRevisions } from "./revisions.js";

export { listDocumentObservations, addDocumentObservation } from "./observations.js";

export { readDocumentResource, readDocumentAttachmentResource } from "./resources.js";
