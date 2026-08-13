import {
  assertAllowedFields,
  createCatalogError,
  normalizeEnum,
  optionalText,
  requiredText,
} from "./topologyRepositorySupport.js";

const FORMATS = ["status", "percent", "number", "date", "text"];
const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/u;
const SENSITIVE_KEY =
  /(?:password|passwd|pwd|secret|token|credential|authorization|api[-_.]?key|private[-_.]?key|kubeconfig|connection[-_.]?string)/iu;

function invalid(message) {
  return createCatalogError(422, "INVALID_MONITORING_TEMPLATE", message);
}

function presentationKey(value, field) {
  const key = requiredText(value, field, 128);
  if (!KEY_PATTERN.test(key) || SENSITIVE_KEY.test(key)) {
    throw invalid(`${field} must be a safe metadata key`);
  }
  return key;
}

function normalizeField(value, index, contractKeys) {
  const field = `definition.presentation.fields[${index}]`;
  assertAllowedFields(
    value,
    ["key", "label", "format", "visualization"],
    field,
  );
  const key = presentationKey(value.key, `${field}.key`);
  if (!contractKeys.has(key))
    throw invalid(`${field}.key is not declared in the output contract`);
  return {
    key,
    label: requiredText(value.label, `${field}.label`, 160),
    format: normalizeEnum(value.format, `${field}.format`, FORMATS),
    visualization: normalizeEnum(
      value.visualization,
      `${field}.visualization`,
      ["badge", "gauge", "value"],
    ),
  };
}

function normalizeSeries(value, index, contractKeys) {
  const field = `definition.presentation.series[${index}]`;
  assertAllowedFields(
    value,
    ["label", "visualization", "xKey", "xFormat", "yKey", "yFormatKey"],
    field,
  );
  const result = {
    label: requiredText(value.label, `${field}.label`, 160),
    visualization: normalizeEnum(
      value.visualization,
      `${field}.visualization`,
      ["line"],
    ),
    xKey: presentationKey(value.xKey, `${field}.xKey`),
    xFormat: normalizeEnum(value.xFormat, `${field}.xFormat`, FORMATS),
    yKey: presentationKey(value.yKey, `${field}.yKey`),
    yFormatKey: presentationKey(value.yFormatKey, `${field}.yFormatKey`),
  };
  for (const key of [result.xKey, result.yKey, result.yFormatKey]) {
    if (!contractKeys.has(key))
      throw invalid(`${field} references undeclared metadata key: ${key}`);
  }
  return result;
}

export function normalizeMonitoringTemplatePresentation(value, contractKeys) {
  assertAllowedFields(
    value,
    ["label", "fields", "series"],
    "definition.presentation",
  );
  const fields = value.fields ?? [];
  const series = value.series ?? [];
  if (
    !Array.isArray(fields) ||
    fields.length > 100 ||
    !Array.isArray(series) ||
    series.length > 20
  ) {
    throw invalid(
      "definition.presentation exceeds the supported field or series limits",
    );
  }
  return {
    label: optionalText(value.label, "definition.presentation.label", 160),
    fields: fields.map((item, index) =>
      normalizeField(item, index, contractKeys),
    ),
    series: series.map((item, index) =>
      normalizeSeries(item, index, contractKeys),
    ),
  };
}
