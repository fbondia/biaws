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

export let requestStatusOptions = REQUEST_STATUS_OPTIONS;

export let allRequestStatusOptions = REQUEST_STATUS_OPTIONS;

export let defaultRequestStatus = DEFAULT_REQUEST_STATUS;

export let taskStatusOptions = REQUEST_TASK_STATUS_OPTIONS;

export let allTaskStatusOptions = REQUEST_TASK_STATUS_OPTIONS;

export let defaultTaskStatus = DEFAULT_REQUEST_TASK_STATUS;

export let checklistLabels = REQUEST_CHECKLIST_ITEMS;

export let defaultSpecificationSectionTitles =
  REQUEST_SPECIFICATION_SECTION_TITLES;

export async function loadRequestOptions(db, query = {}) {
  const lists = await getRequestOptionLists({
    db: db.databaseName,
    authorizationScope: query.authorizationScope,
    workspaceId: query.workspaceId,
  });
  requestStatusOptions = activeValues(lists.demandStatus);
  allRequestStatusOptions = (lists.demandStatus?.items || []).map(
    (item) => item.value,
  );
  defaultRequestStatus =
    lists.demandStatus?.defaultValue ||
    requestStatusOptions[0] ||
    DEFAULT_REQUEST_STATUS;
  taskStatusOptions = activeValues(lists.taskStatus);
  allTaskStatusOptions = (lists.taskStatus?.items || []).map(
    (item) => item.value,
  );
  defaultTaskStatus =
    lists.taskStatus?.defaultValue ||
    taskStatusOptions[0] ||
    DEFAULT_REQUEST_TASK_STATUS;
  checklistLabels = activeValues(lists.checklist);
  defaultSpecificationSectionTitles = activeValues(lists.specificationSections);
}
