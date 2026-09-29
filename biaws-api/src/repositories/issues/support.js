import { ISSUES_COLLECTION } from "./constants.js";
import { findByReference } from "../../helpers/referenceLookup.js";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";

export function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function ensureIssueExists(db, issueId, query = {}) {
  const issue = await findByReference(
    db.collection(ISSUES_COLLECTION),
    issueId,
    {
      filter: buildKnowledgeContextFilter(query),
      identifierField: "identifier",
    },
  );
  if (!issue) throw createHttpError(404, `Issue not found: ${issueId}`);
  return issue;
}
