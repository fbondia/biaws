import { errorMessage } from "../../helpers/error.js";
import { DEFAULT_ISSUE_TYPE_DETECTION } from "../../helpers/issueTypeDetection.js";
import { isRecord } from "../../helpers/records.js";
import { textValue } from "../../helpers/text.js";
import type { OptionItem, OptionList } from "../../types/catalog.js";
import { DEFAULT_COLOR_METADATA, KEY_PATTERN, OPTION_LIST_KEYS } from "./constants.js";
import { createHttpError } from "./support.js";

function defaultItemMetadata(listKey: string, value: string) {
  if (listKey !== OPTION_LIST_KEYS.ISSUE_TYPE) return {};
  const emlImport = DEFAULT_ISSUE_TYPE_DETECTION[value as keyof typeof DEFAULT_ISSUE_TYPE_DETECTION];
  return emlImport ? { emlImport } : {};
}

function normalizeDocumentValue(document: OptionList | null) {
  if (!document) return null;
  return {
    ...document,
    _id: document._id?.toString?.() ?? document._id,
    items: [...(document.items || [])]
      .map((item) => ({
        ...item,
        metadata: {
          ...(DEFAULT_COLOR_METADATA as Record<string, Record<string, Record<string, string>>>)[document.key]?.[
            item.value
          ],
          ...defaultItemMetadata(document.key, item.value),
          ...item.metadata,
        },
      }))
      .sort((a, b) => a.order - b.order),
  };
}

function normalizeEmlImportMetadata(value: unknown, index: number) {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw createHttpError(422, `Invalid option list: items[${index}].metadata.emlImport must be an object`);
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
        `Invalid option list: items[${index}].metadata.emlImport.subjectPatterns[${patternIndex}] is invalid: ${errorMessage(error)}`,
      );
    }
    return normalized;
  });
  return {
    enabled: value.enabled !== false,
    subjectPatterns,
  };
}

function normalizeItem(item: Record<string, unknown> | null | undefined, index: number, key: string): OptionItem {
  const value = textValue(item?.value || "").trim();
  const label = textValue(item?.label || value).trim();
  if (!value) throw createHttpError(422, `Invalid option list: items[${index}].value is required`);
  if (!label) throw createHttpError(422, `Invalid option list: items[${index}].label is required`);
  const metadata: OptionItem["metadata"] = item?.metadata && isRecord(item.metadata) ? { ...item.metadata } : {};
  if (key === OPTION_LIST_KEYS.ISSUE_TYPE) {
    const emlImport = normalizeEmlImportMetadata(metadata.emlImport, index);
    if (emlImport) metadata.emlImport = emlImport;
  }
  return {
    value,
    label,
    active: item?.active !== false,
    order: Number.isFinite(Number(item?.order)) ? Number(item?.order) : (index + 1) * 10,
    metadata,
  };
}

export function normalizeOptionListPayload(
  payload: Record<string, unknown> = {},
  current: Partial<OptionList> | null = null,
) {
  const key = textValue(payload.key ?? current?.key ?? "").trim();
  const name = textValue(payload.name ?? current?.name ?? "").trim();
  const items = (Array.isArray(payload.items) ? payload.items : current?.items || []).map((item, index: number) =>
    normalizeItem(item, index, key),
  );
  if (!KEY_PATTERN.test(key)) throw createHttpError(422, "Invalid option list: key must use lowercase dot notation");
  if (!name) throw createHttpError(422, "Invalid option list: name is required");
  if (!items.length) throw createHttpError(422, "Invalid option list: at least one item is required");
  const duplicates = items.filter(
    (item, index: number) => items.findIndex((candidate) => candidate.value === item.value) !== index,
  );
  if (duplicates.length) throw createHttpError(422, `Invalid option list: duplicate value ${duplicates[0].value}`);
  const defaultValue = textValue(payload.defaultValue ?? current?.defaultValue ?? "").trim();
  if (defaultValue && !items.some((item) => item.value === defaultValue && item.active)) {
    throw createHttpError(422, "Invalid option list: defaultValue must reference an active item");
  }
  return {
    key,
    name,
    description: textValue(payload.description ?? current?.description ?? "").trim(),
    defaultValue,
    items: items.toSorted((a: { order: number }, b: { order: number }) => a.order - b.order),
  };
}

export function optionListReplicationPayload(optionList: Partial<OptionList> = {}) {
  return {
    key: optionList.key,
    name: optionList.name,
    description: optionList.description || "",
    defaultValue: optionList.defaultValue || "",
    items: (optionList.items || []).map(({ value, label, active, order, metadata }) => ({
      value,
      label,
      active,
      order,
      metadata: structuredClone(metadata || {}),
    })),
  };
}

export function activeValues(list: Partial<OptionList> | null | undefined) {
  return (list?.items || []).filter((item: { active: boolean }) => item.active !== false).map((item) => item.value);
}

export function normalizeDocument(
  document: NonNullable<Parameters<typeof normalizeDocumentValue>[0]>,
): NonNullable<ReturnType<typeof normalizeDocumentValue>>;
export function normalizeDocument(
  document: Parameters<typeof normalizeDocumentValue>[0],
): ReturnType<typeof normalizeDocumentValue>;
export function normalizeDocument(document: Parameters<typeof normalizeDocumentValue>[0]) {
  return normalizeDocumentValue(document);
}
