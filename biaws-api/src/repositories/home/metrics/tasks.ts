import type { Db } from "mongodb";
import { REQUEST_TASK_STATUS_OPTIONS } from "../../../../../shared/requestConstants.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";
import { getPagination } from "../../../helpers/query.js";
import { textValue } from "../../../helpers/text.js";
import type { Actor, RepositoryQuery } from "../../../types/http.js";
import { OPTION_LIST_KEYS, OPTION_LISTS_COLLECTION } from "../../optionLists/constants.js";
import { scopedFilter } from "../filters.js";
import { COMPLETED_TASK_STATUSES, DEFAULT_PENDING_TASKS_LIMIT } from "../widgets.js";

export function pendingTasksPagination(query: RepositoryQuery = {}) {
  const requestedLimit = textValue(query.limit ?? "").trim() ? query.limit : DEFAULT_PENDING_TASKS_LIMIT;
  return getPagination({ ...query, limit: requestedLimit });
}

async function pendingTaskStatusOptions(database: Db, actor: Partial<Actor>) {
  const optionList = await database.collection(OPTION_LISTS_COLLECTION).findOne(
    {
      workspaceId: String(actor.workspaceId || ""),
      key: OPTION_LIST_KEYS.TASK_STATUS,
    },
    { projection: { items: 1 } },
  );
  const configuredStatuses = [...(optionList?.items || [])]
    .sort((first, second) => Number(first.order) - Number(second.order))
    .map(({ value }) => value)
    .filter(Boolean);

  return configuredStatuses.length ? configuredStatuses : REQUEST_TASK_STATUS_OPTIONS;
}

export async function buildPendingTasksMetric(database: Db, actor: Partial<Actor>, query: RepositoryQuery = {}) {
  const pagination = pendingTasksPagination(query);
  const statusOptions = await pendingTaskStatusOptions(database, actor);
  const requests = await database
    .collection<{ clientCode?: string; title?: string }>(COLLECTION_NAMES.REQUESTS)
    .find(scopedFilter(actor, "demands.read"))
    .project({ _id: 1, clientCode: 1, title: 1 })
    .toArray();
  const requestIds = requests.map(({ _id }) => _id);
  if (!requestIds.length) {
    return {
      kind: "tasks",
      value: 0,
      items: [],
      page: pagination.page,
      limit: pagination.limit,
      hasMore: false,
    };
  }
  const filter = {
    requestId: { $in: requestIds },
    status: { $nin: COMPLETED_TASK_STATUSES },
  };
  const [value, tasks] = await Promise.all([
    database.collection(COLLECTION_NAMES.REQUEST_TASKS).countDocuments(filter),
    database
      .collection(COLLECTION_NAMES.REQUEST_TASKS)
      .aggregate(
        [
          { $match: filter },
          {
            $addFields: {
              __taskStatusOrder: {
                $let: {
                  vars: {
                    position: { $indexOfArray: [statusOptions, "$status"] },
                  },
                  in: {
                    $cond: [{ $gte: ["$$position", 0] }, "$$position", statusOptions.length],
                  },
                },
              },
              __taskIdentifier: {
                $cond: [{ $gt: [{ $strLenCP: { $ifNull: ["$code", ""] } }, 0] }, "$code", { $toString: "$_id" }],
              },
            },
          },
          {
            $sort: {
              __taskStatusOrder: 1,
              __taskIdentifier: 1,
              createdAt: -1,
              _id: 1,
            },
          },
          { $skip: pagination.skip },
          { $limit: pagination.limit },
          { $unset: ["__taskStatusOrder", "__taskIdentifier"] },
        ],
        { collation: { locale: "pt", numericOrdering: true, strength: 1 } },
      )
      .toArray(),
  ]);
  const requestDetails = new Map(
    requests.map(({ _id, clientCode, title }) => [
      _id.toString(),
      { clientCode: clientCode || "", title: title || "Melhoria" },
    ]),
  );
  return {
    kind: "tasks",
    value,
    page: pagination.page,
    limit: pagination.limit,
    hasMore: pagination.skip + tasks.length < value,
    items: tasks.map((task) => {
      const request = requestDetails.get(task.requestId?.toString()) || {
        clientCode: "",
        title: "Melhoria",
      };
      return {
        id: task._id.toString(),
        code: task.code || "",
        requestId: task.requestId?.toString() || "",
        requestCode: request.clientCode || "",
        title: task.title,
        status: task.status,
        endDate: task.endDate || "",
        requestTitle: request.title || "Melhoria",
      };
    }),
  };
}

export async function getPendingTasksMetric(actor: Actor, query: RepositoryQuery = {}) {
  const database = await getMongoDatabase();
  return buildPendingTasksMetric(database, actor, query);
}
