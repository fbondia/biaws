import { RUNTIME_STATUSES } from "../../../shared/index.js";
import {
  assertAllowedFields,
  createCatalogError,
  normalizeEnum,
  requiredText,
} from "./topologyRepositorySupport.js";
import { normalizeMonitoringTemplatePresentation } from "./monitoringTemplatePresentation.js";

const FIELD_TYPES = ["boolean", "number", "integer", "string", "array"];
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/u;
const INPUT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;
const SENSITIVE_KEY =
  /(?:password|passwd|pwd|secret|token|credential|authorization|api[-_.]?key|private[-_.]?key|kubeconfig|connection[-_.]?string)/iu;

function invalid(message) {
  return createCatalogError(422, "INVALID_MONITORING_TEMPLATE", message);
}

function safeKey(value, field) {
  const key = requiredText(value, field, 128);
  if (!KEY_PATTERN.test(key) || SENSITIVE_KEY.test(key)) {
    throw invalid(`${field} must be a safe metadata key`);
  }
  return key;
}

function safeInputKey(value, field) {
  const key = requiredText(value, field, 128);
  if (!INPUT_KEY_PATTERN.test(key) || SENSITIVE_KEY.test(key)) {
    throw invalid(`${field} must be a safe JSON key`);
  }
  return key;
}

function safeJson(value, field, depth = 0, state = { nodes: 0 }) {
  state.nodes += 1;
  if (state.nodes > 1_000 || depth > 8) {
    throw invalid(`${field} is too deeply nested or contains too many values`);
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value === "string") {
    if (value.length > 8_000) throw invalid(`${field} contains a long string`);
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > 100) throw invalid(`${field} contains too many items`);
    return value.map((item, index) =>
      safeJson(item, `${field}[${index}]`, depth + 1, state),
    );
  }
  if (!value || typeof value !== "object") {
    throw invalid(`${field} must contain JSON-compatible values`);
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    safeInputKey(key, `${field} key`);
    result[key] = safeJson(item, `${field}.${key}`, depth + 1, state);
  }
  return result;
}

function normalizeMetadataField(value, index) {
  const field = `definition.output.metadata.fields[${index}]`;
  assertAllowedFields(
    value,
    [
      "key",
      "type",
      "required",
      "enum",
      "minimum",
      "maximum",
      "items",
      "maxItems",
    ],
    field,
  );
  const result = {
    key: safeKey(value.key, `${field}.key`),
    type: normalizeEnum(value.type, `${field}.type`, FIELD_TYPES),
    required: value.required === true,
  };
  if (value.enum !== undefined) {
    if (
      !Array.isArray(value.enum) ||
      !value.enum.length ||
      value.enum.length > 50
    ) {
      throw invalid(`${field}.enum must contain between 1 and 50 values`);
    }
    result.enum = value.enum.map((item, itemIndex) =>
      safeJson(item, `${field}.enum[${itemIndex}]`),
    );
  }
  for (const key of ["minimum", "maximum"]) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
        throw invalid(`${field}.${key} must be a finite number`);
      }
      result[key] = value[key];
    }
  }
  if (
    result.minimum !== undefined &&
    result.maximum !== undefined &&
    result.minimum > result.maximum
  ) {
    throw invalid(`${field}.minimum must not exceed maximum`);
  }
  if (result.type === "array") {
    result.items = normalizeEnum(
      value.items,
      `${field}.items`,
      FIELD_TYPES.filter((type) => type !== "array"),
    );
    const maxItems = value.maxItems ?? 100;
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 100) {
      throw invalid(`${field}.maxItems must be between 1 and 100`);
    }
    result.maxItems = maxItems;
  } else if (value.items !== undefined || value.maxItems !== undefined) {
    throw invalid(`${field}.items and maxItems require type array`);
  }
  return result;
}

export function isUnifiedMonitoringTemplateDefinition(value) {
  return (
    value?.schemaVersion !== undefined || value?.transformation !== undefined
  );
}

export function normalizeUnifiedMonitoringTemplateDefinition(value = {}) {
  assertAllowedFields(
    value,
    ["schemaVersion", "input", "transformation", "output", "presentation"],
    "template definition",
  );
  if (String(value.schemaVersion) !== "1")
    throw invalid("definition.schemaVersion must be 1");

  assertAllowedFields(value.input, ["mediaType", "sample"], "definition.input");
  const input = {
    mediaType: normalizeEnum(
      value.input?.mediaType,
      "definition.input.mediaType",
      ["application/json"],
    ),
    sample: safeJson(value.input?.sample, "definition.input.sample"),
  };

  assertAllowedFields(
    value.transformation,
    ["language", "expression"],
    "definition.transformation",
  );
  const transformation = {
    language: normalizeEnum(
      value.transformation?.language,
      "definition.transformation.language",
      ["jsonata"],
    ),
    expression: requiredText(
      value.transformation?.expression,
      "definition.transformation.expression",
      20_000,
    ),
  };
  if (/(?:\bfunction\s*\(|λ|\$eval\s*\()/u.test(transformation.expression)) {
    throw invalid(
      "definition.transformation.expression cannot define functions or evaluate expressions dynamically",
    );
  }

  assertAllowedFields(
    value.output,
    ["status", "message", "metadata"],
    "definition.output",
  );
  assertAllowedFields(
    value.output?.status,
    ["type", "required", "enum"],
    "definition.output.status",
  );
  assertAllowedFields(
    value.output?.message,
    ["type", "required", "maxLength"],
    "definition.output.message",
  );
  assertAllowedFields(
    value.output?.metadata,
    ["type", "required", "additionalProperties", "fields"],
    "definition.output.metadata",
  );
  const statusValues = value.output?.status?.enum;
  if (
    !Array.isArray(statusValues) ||
    !statusValues.length ||
    statusValues.some(
      (status) => !RUNTIME_STATUSES.includes(status) || status === "archived",
    )
  ) {
    throw invalid(
      "definition.output.status.enum must contain supported runtime statuses",
    );
  }
  const rawFields = value.output?.metadata?.fields;
  if (!Array.isArray(rawFields) || rawFields.length > 100) {
    throw invalid(
      "definition.output.metadata.fields must be an array with at most 100 fields",
    );
  }
  const metadataFields = rawFields.map((field, index) =>
    normalizeMetadataField(field, index),
  );
  const contractKeys = new Set(metadataFields.map(({ key }) => key));
  if (contractKeys.size !== metadataFields.length)
    throw invalid("definition.output.metadata.fields contains duplicate keys");
  const output = {
    status: {
      type: normalizeEnum(
        value.output?.status?.type,
        "definition.output.status.type",
        ["string"],
      ),
      required: value.output?.status?.required === true,
      enum: [...new Set(statusValues)],
    },
    message: {
      type: normalizeEnum(
        value.output?.message?.type,
        "definition.output.message.type",
        ["string"],
      ),
      required: value.output?.message?.required === true,
      maxLength: value.output?.message?.maxLength ?? 2_000,
    },
    metadata: {
      type: normalizeEnum(
        value.output?.metadata?.type,
        "definition.output.metadata.type",
        ["object"],
      ),
      required: value.output?.metadata?.required === true,
      additionalProperties:
        value.output?.metadata?.additionalProperties === true,
      fields: metadataFields,
    },
  };
  if (!output.status.required)
    throw invalid("definition.output.status.required must be true");
  if (
    !Number.isInteger(output.message.maxLength) ||
    output.message.maxLength < 1 ||
    output.message.maxLength > 2_000
  ) {
    throw invalid(
      "definition.output.message.maxLength must be between 1 and 2000",
    );
  }

  return {
    schemaVersion: "1",
    input,
    transformation,
    output,
    presentation: normalizeMonitoringTemplatePresentation(
      value.presentation,
      contractKeys,
    ),
  };
}

export function unifiedMonitoringTemplateSnapshot(template) {
  if (!isUnifiedMonitoringTemplateDefinition(template?.definition)) return null;
  return {
    schemaVersion: template.definition.schemaVersion,
    input: template.definition.input,
    output: template.definition.output,
    presentation: template.definition.presentation,
  };
}
