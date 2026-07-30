import {
  DEFAULT_REQUEST_STATUS,
  DEFAULT_REQUEST_TASK_STATUS,
  REQUEST_CHECKLIST_ITEMS,
  REQUEST_SPECIFICATION_SECTION_TITLES,
  REQUEST_STATUS_COLORS,
  REQUEST_TASK_STATUS_COLORS,
} from "../../../shared/requestConstants.js";
import {
  DEFAULT_ISSUE_STATUS,
  DEFAULT_ISSUE_TYPE,
  ISSUE_STATUS_OPTIONS,
  ISSUE_TYPE_OPTIONS,
} from "../../../shared/issueConstants.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { DEFAULT_ISSUE_TYPE_DETECTION } from "../helpers/issueTypeDetection.js";

export const OPTION_LISTS_COLLECTION = COLLECTION_NAMES.OPTION_LISTS;

export const OPTION_LIST_KEYS = Object.freeze({
  ISSUE_TYPE: "issue.type",
  ISSUE_STATUS: "issue.status",
  DEMAND_STATUS: "demand.status",
  TASK_STATUS: "demand.task-status",
  CHECKLIST: "demand.checklist",
  SPECIFICATION_SECTIONS: "demand.specification-sections",
});

const KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

const DEFAULT_OPTION_LISTS = Object.freeze([
  {
    key: OPTION_LIST_KEYS.ISSUE_TYPE,
    name: "Tipos de issues",
    description:
      "Tipos disponíveis para cadastro, importação e filtro de issues.",
    defaultValue: DEFAULT_ISSUE_TYPE,
    items: ISSUE_TYPE_OPTIONS.map((item, index) => ({
      ...item,
      active: true,
      order: (index + 1) * 10,
      metadata: {
        emlImport: DEFAULT_ISSUE_TYPE_DETECTION[item.value] || {
          enabled: false,
          subjectPatterns: [],
        },
      },
    })),
  },
  {
    key: OPTION_LIST_KEYS.ISSUE_STATUS,
    name: "Status de issues",
    description:
      "Situações disponíveis para cadastro, edição e filtro de issues.",
    defaultValue: DEFAULT_ISSUE_STATUS,
    items: ISSUE_STATUS_OPTIONS.map((item, index) => ({
      ...item,
      active: true,
      order: (index + 1) * 10,
      metadata: {},
    })),
  },
  {
    key: OPTION_LIST_KEYS.DEMAND_STATUS,
    name: "Status de demandas",
    description: "Situações disponíveis para uma demanda.",
    defaultValue: DEFAULT_REQUEST_STATUS,
    items: Object.entries(REQUEST_STATUS_COLORS).map(
      ([value, metadata], index) => ({
        value,
        label: value,
        active: true,
        order: (index + 1) * 10,
        metadata,
      }),
    ),
  },
  {
    key: OPTION_LIST_KEYS.TASK_STATUS,
    name: "Status de tarefas",
    description: "Situações disponíveis para tarefas de demandas.",
    defaultValue: DEFAULT_REQUEST_TASK_STATUS,
    items: Object.entries(REQUEST_TASK_STATUS_COLORS).map(
      ([value, metadata], index) => ({
        value,
        label: value,
        active: true,
        order: (index + 1) * 10,
        metadata,
      }),
    ),
  },
  {
    key: OPTION_LIST_KEYS.CHECKLIST,
    name: "Checklist de demandas",
    description:
      "Etapas criadas automaticamente no checklist de novas demandas.",
    defaultValue: "",
    items: REQUEST_CHECKLIST_ITEMS.map((value, index) => ({
      value,
      label: value,
      active: true,
      order: (index + 1) * 10,
      metadata: {},
    })),
  },
  {
    key: OPTION_LIST_KEYS.SPECIFICATION_SECTIONS,
    name: "Seções da especificação",
    description: "Seções criadas automaticamente na especificação técnica.",
    defaultValue: "",
    items: REQUEST_SPECIFICATION_SECTION_TITLES.map((value, index) => ({
      value,
      label: value,
      active: true,
      order: (index + 1) * 10,
      metadata: {},
    })),
  },
]);

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const DEFAULT_COLOR_METADATA = {
  [OPTION_LIST_KEYS.DEMAND_STATUS]: REQUEST_STATUS_COLORS,
  [OPTION_LIST_KEYS.TASK_STATUS]: REQUEST_TASK_STATUS_COLORS,
};

function defaultItemMetadata(listKey, value) {
  if (listKey !== OPTION_LIST_KEYS.ISSUE_TYPE) return {};
  const emlImport = DEFAULT_ISSUE_TYPE_DETECTION[value];
  return emlImport ? { emlImport } : {};
}

function normalizeDocument(document) {
  if (!document) return null;
  return {
    ...document,
    _id: document._id?.toString?.() ?? document._id,
    items: [...(document.items || [])]
      .map((item) => ({
        ...item,
        metadata: {
          ...(DEFAULT_COLOR_METADATA[document.key]?.[item.value] || {}),
          ...defaultItemMetadata(document.key, item.value),
          ...(item.metadata || {}),
        },
      }))
      .sort((a, b) => a.order - b.order),
  };
}

function normalizeEmlImportMetadata(value, index) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(
      422,
      `Invalid option list: items[${index}].metadata.emlImport must be an object`,
    );
  }
  if (!Array.isArray(value.subjectPatterns)) {
    throw createHttpError(
      422,
      `Invalid option list: items[${index}].metadata.emlImport.subjectPatterns must be an array`,
    );
  }
  if (value.subjectPatterns.length > 20) {
    throw createHttpError(
      422,
      `Invalid option list: items[${index}].metadata.emlImport.subjectPatterns must contain at most 20 items`,
    );
  }
  const subjectPatterns = value.subjectPatterns.map((pattern, patternIndex) => {
    const normalized = String(pattern || "").trim();
    if (!normalized || normalized.length > 1000) {
      throw createHttpError(
        422,
        `Invalid option list: items[${index}].metadata.emlImport.subjectPatterns[${patternIndex}] must contain between 1 and 1000 characters`,
      );
    }
    try {
      new RegExp(normalized, "iu");
    } catch (error) {
      throw createHttpError(
        422,
        `Invalid option list: items[${index}].metadata.emlImport.subjectPatterns[${patternIndex}] is invalid: ${error.message}`,
      );
    }
    return normalized;
  });
  return {
    enabled: value.enabled !== false,
    subjectPatterns,
  };
}

function normalizeItem(item, index, key) {
  const value = String(item?.value || "").trim();
  const label = String(item?.label || value).trim();
  if (!value)
    throw createHttpError(
      422,
      `Invalid option list: items[${index}].value is required`,
    );
  if (!label)
    throw createHttpError(
      422,
      `Invalid option list: items[${index}].label is required`,
    );
  const metadata =
    item?.metadata &&
    typeof item.metadata === "object" &&
    !Array.isArray(item.metadata)
      ? { ...item.metadata }
      : {};
  if (key === OPTION_LIST_KEYS.ISSUE_TYPE) {
    const emlImport = normalizeEmlImportMetadata(metadata.emlImport, index);
    if (emlImport) metadata.emlImport = emlImport;
  }
  return {
    value,
    label,
    active: item?.active !== false,
    order: Number.isFinite(Number(item?.order))
      ? Number(item.order)
      : (index + 1) * 10,
    metadata,
  };
}

export function normalizeOptionListPayload(payload = {}, current = null) {
  const key = String(payload.key ?? current?.key ?? "").trim();
  const name = String(payload.name ?? current?.name ?? "").trim();
  const items = (
    Array.isArray(payload.items) ? payload.items : current?.items || []
  ).map((item, index) => normalizeItem(item, index, key));
  if (!KEY_PATTERN.test(key))
    throw createHttpError(
      422,
      "Invalid option list: key must use lowercase dot notation",
    );
  if (!name)
    throw createHttpError(422, "Invalid option list: name is required");
  if (!items.length)
    throw createHttpError(
      422,
      "Invalid option list: at least one item is required",
    );
  const duplicates = items.filter(
    (item, index) =>
      items.findIndex((candidate) => candidate.value === item.value) !== index,
  );
  if (duplicates.length)
    throw createHttpError(
      422,
      `Invalid option list: duplicate value ${duplicates[0].value}`,
    );
  const defaultValue = String(
    payload.defaultValue ?? current?.defaultValue ?? "",
  ).trim();
  if (
    defaultValue &&
    !items.some((item) => item.value === defaultValue && item.active)
  ) {
    throw createHttpError(
      422,
      "Invalid option list: defaultValue must reference an active item",
    );
  }
  return {
    key,
    name,
    description: String(
      payload.description ?? current?.description ?? "",
    ).trim(),
    defaultValue,
    items: items.sort((a, b) => a.order - b.order),
  };
}

async function getCollection(query = {}) {
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const collection = db.collection(OPTION_LISTS_COLLECTION);
  const workspaceId = String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
  await collection.createIndex({ workspaceId: 1, key: 1 }, { unique: true });
  const now = new Date();
  await Promise.all(
    DEFAULT_OPTION_LISTS.map((list) =>
      collection.updateOne(
        { workspaceId, key: list.key },
        {
          $setOnInsert: {
            ...list,
            workspaceId,
            createdAt: now,
            updatedAt: now,
            version: 1,
          },
        },
        { upsert: true },
      ),
    ),
  );
  return { db, collection, workspaceId };
}

export async function listOptionLists(query = {}) {
  const { db, collection, workspaceId } = await getCollection(query);
  const items = await collection
    .find({ workspaceId })
    .sort({ name: 1 })
    .toArray();
  return {
    meta: {
      database: db.databaseName,
      collection: OPTION_LISTS_COLLECTION,
      total: items.length,
    },
    items: items.map(normalizeDocument),
  };
}

export async function getOptionList(key, query = {}) {
  const { collection, workspaceId } = await getCollection(query);
  return normalizeDocument(await collection.findOne({ workspaceId, key }));
}

export async function updateOptionList(key, payload = {}, query = {}) {
  const { collection, workspaceId } = await getCollection(query);
  const current = await collection.findOne({ workspaceId, key });
  if (!current) throw createHttpError(404, `Option list not found: ${key}`);
  const normalized = normalizeOptionListPayload({ ...payload, key }, current);
  const now = new Date();
  await collection.updateOne(
    { workspaceId, key },
    { $set: { ...normalized, updatedAt: now }, $inc: { version: 1 } },
  );
  return normalizeDocument(await collection.findOne({ workspaceId, key }));
}

export function activeValues(list) {
  return (list?.items || [])
    .filter((item) => item.active !== false)
    .map((item) => item.value);
}

export async function getRequestOptionLists(query = {}) {
  const result = await listOptionLists(query);
  const byKey = Object.fromEntries(
    result.items.map((list) => [list.key, list]),
  );
  return {
    demandStatus: byKey[OPTION_LIST_KEYS.DEMAND_STATUS],
    taskStatus: byKey[OPTION_LIST_KEYS.TASK_STATUS],
    checklist: byKey[OPTION_LIST_KEYS.CHECKLIST],
    specificationSections: byKey[OPTION_LIST_KEYS.SPECIFICATION_SECTIONS],
  };
}

export async function getIssueOptionLists(query = {}) {
  const result = await listOptionLists(query);
  const byKey = Object.fromEntries(
    result.items.map((list) => [list.key, list]),
  );
  return {
    types: byKey[OPTION_LIST_KEYS.ISSUE_TYPE],
    statuses: byKey[OPTION_LIST_KEYS.ISSUE_STATUS],
  };
}
