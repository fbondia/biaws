import {
  OPTION_LIST_KEYS,
  DEFAULT_COLOR_METADATA,
  KEY_PATTERN,
} from "./constants.js";
import { createHttpError } from "./support.js";
import { DEFAULT_ISSUE_TYPE_DETECTION } from "../../helpers/issueTypeDetection.js";

function defaultItemMetadata(listKey, value) {
  if (listKey !== OPTION_LIST_KEYS.ISSUE_TYPE) return {};
  const emlImport = DEFAULT_ISSUE_TYPE_DETECTION[value];
  return emlImport ? { emlImport } : {};
}

export function normalizeDocument(document) {
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

export function optionListReplicationPayload(optionList = {}) {
  return {
    key: optionList.key,
    name: optionList.name,
    description: optionList.description || "",
    defaultValue: optionList.defaultValue || "",
    items: (optionList.items || []).map(
      ({ value, label, active, order, metadata }) => ({
        value,
        label,
        active,
        order,
        metadata: structuredClone(metadata || {}),
      }),
    ),
  };
}

export function activeValues(list) {
  return (list?.items || [])
    .filter((item) => item.active !== false)
    .map((item) => item.value);
}
