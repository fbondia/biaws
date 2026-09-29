import type { Db } from "mongodb";
import type { RepositoryQuery } from "../../types/http.js";
import {
  DEFAULT_ISSUE_STATUS,
  DEFAULT_ISSUE_TYPE,
  ISSUE_STATUS_OPTIONS,
  ISSUE_TYPE_OPTIONS,
} from "../../../../shared/issueConstants.js";
import { activeValues } from "../optionLists/normalization.js";
import { getIssueOptionLists } from "../optionLists/queries.js";

export async function loadIssueOptions(db: Db, query: RepositoryQuery = {}) {
  const lists = await getIssueOptionLists({
    db: db.databaseName,
    authorizationScope: query.authorizationScope,
    workspaceId: query.workspaceId,
  });
  const types = activeValues(lists.types);
  const statuses = activeValues(lists.statuses);

  return {
    types: types.length ? types : ISSUE_TYPE_OPTIONS.map((item) => item.value),
    statuses: statuses.length
      ? statuses
      : ISSUE_STATUS_OPTIONS.map((item) => item.value),
    defaultType: lists.types?.defaultValue || types[0] || DEFAULT_ISSUE_TYPE,
    defaultStatus:
      lists.statuses?.defaultValue || statuses[0] || DEFAULT_ISSUE_STATUS,
  };
}
