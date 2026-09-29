import { ISSUES_COLLECTION } from "./constants.js";
import { ensureIssueExists, createHttpError } from "./support.js";
import { getIssue } from "./queries.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import { normalizeClassificationPayload } from "../../helpers/issueClassification.js";
import { assertTaxonomyIdsApplicable } from "../../helpers/taxonomy.js";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";

export async function saveIssueClassification(
  issueId,
  payload = {},
  query = {},
) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(ISSUES_COLLECTION);
  const classification = normalizeClassificationPayload(payload);
  const now = new Date();
  const issue = await ensureIssueExists(db, issueId, query);
  issueId = issue.id;
  if (!issue) throw createHttpError(404, `Issue not found: ${issueId}`);
  await assertTaxonomyIdsApplicable(
    db,
    [classification.primaryTaxonomyId, ...classification.secondaryTaxonomyIds],
    issue.workspaceId,
    issue.applicationId,
  );

  const result = await collection.updateOne(
    { id: issueId, ...buildKnowledgeContextFilter(query) },
    {
      $set: {
        classification: {
          ...classification,
          updatedAt: now,
          updatedBy: payload.updatedBy || "biaws-ui",
        },
        updatedAt: now,
        updatedBy: payload.updatedBy || "biaws-ui",
      },
    },
  );

  if (!result.matchedCount) {
    throw createHttpError(404, `Issue not found: ${issueId}`);
  }

  return getIssue(issueId, query);
}
