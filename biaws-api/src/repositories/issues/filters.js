import { buildIssueFilter } from "../../helpers/query.js";
import { expandTaxonomyIds } from "../../helpers/taxonomy.js";
import { buildKnowledgeContextFilter } from "../shared/knowledgeContext.js";

function readTaxonomyIds(query = {}) {
  return String(query.taxonomy || query.taxonomyIds || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export async function buildExpandedIssueFilter(db, query) {
  const taxonomyIds = await expandTaxonomyIds(
    db,
    readTaxonomyIds(query),
    query.authorizationScope?.workspaceId || query.workspaceId,
  );
  return {
    ...buildIssueFilter(query, { taxonomyIds }),
    ...buildKnowledgeContextFilter(query),
  };
}
