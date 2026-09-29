import { getDocument } from "./queries.js";
import {
  required,
  resourceResponse,
  attachmentResourceResponse,
} from "../shared/resourceReads.js";
import { COLLECTION_NAMES as C } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";

export async function readDocumentResource(id, part, params = {}, query = {}) {
  let root, value;

  root = required((await getDocument(id, query)).document);
  if (part === "revision" || part === "observation") {
    const db = await getMongoDatabase({
      db: query.db,
      database: query.database,
    });
    const collection =
      part === "revision" ? C.KNOWLEDGE_REVISIONS : C.KNOWLEDGE_OBSERVATIONS;
    const lookup =
      part === "revision"
        ? { revision: Number(params.revision) }
        : { id: params.observationId };
    value = required(
      await db.collection(collection).findOne({
        entityType: "document",
        entityId: root.id,
        workspaceId: root.workspaceId,
        ...lookup,
      }),
    );
    value = { ...value, _id: value._id?.toString() };
  } else
    value = part === "content" ? root.markdown || "" : root.references || [];

  return resourceResponse(root, value, params, query);
}

export async function readDocumentAttachmentResource(id, params, query = {}) {
  const root = required((await getDocument(id, query)).document);
  return attachmentResourceResponse(
    root,
    root.attachments || [],
    params,
    query,
  );
}
