import type { Db } from "mongodb";
import type { RepositoryQuery } from "../../types/http.js";
import {
  DEFAULT_REQUEST_STATUS,
  DEFAULT_REQUEST_TASK_STATUS,
  REQUEST_CHECKLIST_ITEMS,
  REQUEST_SPECIFICATION_SECTION_TITLES,
  REQUEST_STATUS_OPTIONS,
  REQUEST_TASK_STATUS_OPTIONS,
} from "../../../../shared/requestConstants.js";
import { activeValues } from "../optionLists/normalization.js";
import { getRequestOptionLists } from "../optionLists/queries.js";

export const requestOptions = {
  requestStatusOptions: REQUEST_STATUS_OPTIONS,
  allRequestStatusOptions: REQUEST_STATUS_OPTIONS,
  defaultRequestStatus: DEFAULT_REQUEST_STATUS,
  taskStatusOptions: REQUEST_TASK_STATUS_OPTIONS,
  allTaskStatusOptions: REQUEST_TASK_STATUS_OPTIONS,
  defaultTaskStatus: DEFAULT_REQUEST_TASK_STATUS,
  checklistLabels: REQUEST_CHECKLIST_ITEMS,
  defaultSpecificationSectionTitles: REQUEST_SPECIFICATION_SECTION_TITLES,
};

export async function loadRequestOptions(db: Db, query: RepositoryQuery = {}) {
  const lists = await getRequestOptionLists({
    db: db.databaseName,
    authorizationScope: query.authorizationScope,
    workspaceId: query.workspaceId,
  });
  requestOptions.requestStatusOptions = activeValues(lists.demandStatus);
  requestOptions.allRequestStatusOptions = (lists.demandStatus?.items || []).map((item) => item.value);
  requestOptions.defaultRequestStatus =
    lists.demandStatus?.defaultValue || requestOptions.requestStatusOptions[0] || DEFAULT_REQUEST_STATUS;
  requestOptions.taskStatusOptions = activeValues(lists.taskStatus);
  requestOptions.allTaskStatusOptions = (lists.taskStatus?.items || []).map((item) => item.value);
  requestOptions.defaultTaskStatus =
    lists.taskStatus?.defaultValue || requestOptions.taskStatusOptions[0] || DEFAULT_REQUEST_TASK_STATUS;
  requestOptions.checklistLabels = activeValues(lists.checklist);
  requestOptions.defaultSpecificationSectionTitles = activeValues(lists.specificationSections);
}
