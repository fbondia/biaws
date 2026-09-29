import type { Db } from "mongodb";
import type { RepositoryQuery } from "../../types/http.js";
import { ISSUES_COLLECTION } from "./constants.js";
import { findByReference } from "../../helpers/referenceLookup.js";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";
import type { IssueDocument } from "../../types/issues.js";

export function createHttpError(statusCode: number | undefined, message: string | undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function ensureIssueExists(db: Db, issueId: string | string[], query: RepositoryQuery = {}) {
  const issue = await findByReference<IssueDocument>(db.collection<IssueDocument>(ISSUES_COLLECTION), issueId, {
    filter: buildKnowledgeContextFilter(query),
    identifierField: "identifier",
  });
  if (!issue) throw createHttpError(404, `Issue not found: ${issueId}`);
  return issue;
}
