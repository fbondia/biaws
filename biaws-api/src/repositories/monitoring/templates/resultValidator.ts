import { isRecord } from "../../../helpers/records.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import type { MetadataField, UnifiedResultContract } from "./resultTypes.js";

const SAFE_METADATA_KEY = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/u;

const SENSITIVE_KEY =
  /(?:password|passwd|pwd|secret|token|credential|authorization|api[-_.]?key|private[-_.]?key|kubeconfig|connection[-_.]?string)/iu;

function invalid(message: string) {
  return createCatalogError(422, "INVALID_MONITORING_TEMPLATE_RESULT", message);
}

function matchesType(value: unknown, type: string) {
  if (type === "boolean") return typeof value === "boolean";
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "array") return Array.isArray(value);
  return false;
}

function sameJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateScalar(
  value: unknown,
  field: Pick<MetadataField, "type" | "enum" | "minimum" | "maximum">,
  path: string,
) {
  if (!matchesType(value, field.type)) {
    throw invalid(`${path} must match the declared ${field.type} type`);
  }
  if (field.enum && !field.enum.some((item) => sameJson(item, value))) {
    throw invalid(`${path} must match one of the declared values`);
  }
  if (field.minimum !== undefined && Number(value) < field.minimum) {
    throw invalid(`${path} must be at least ${field.minimum}`);
  }
  if (field.maximum !== undefined && Number(value) > field.maximum) {
    throw invalid(`${path} must be at most ${field.maximum}`);
  }
}

function validateField(value: unknown, field: MetadataField) {
  const path = `result.metadata.${field.key}`;
  if (value === undefined) {
    if (field.required) throw invalid(`${path} is required`);
    return;
  }
  if (field.type !== "array") return validateScalar(value, field, path);
  if (!Array.isArray(value)) throw invalid(`${path} must be an array`);
  if (value.length > (field.maxItems ?? 100)) {
    throw invalid(`${path} must contain at most ${field.maxItems} items`);
  }
  value.forEach((item, index: number) => validateScalar(item, { type: field.items || "" }, `${path}[${index}]`));
}

function validateSeries(
  metadata: Record<string, unknown>,
  series: UnifiedResultContract["presentation"]["series"][number],
) {
  const values = [metadata[series.xKey], metadata[series.yKey], metadata[series.yFormatKey]];
  const present = values.filter((value: unknown) => value !== undefined);
  if (!present.length) return;
  if (present.length !== values.length) {
    throw invalid(`result metadata series ${series.label} must provide all declared keys`);
  }
  if (!Array.isArray(values[0]) || !Array.isArray(values[1]) || values[0].length !== values[1].length) {
    throw invalid(`result metadata series ${series.label} must contain aligned arrays`);
  }
}

function validateAdditionalMetadata(value: unknown, key: string) {
  if (!SAFE_METADATA_KEY.test(key) || SENSITIVE_KEY.test(key)) {
    throw invalid(`result.metadata contains an unsafe field: ${key}`);
  }
  const values = Array.isArray(value) ? value : [value];
  if (
    values.length > 100 ||
    values.some(
      (item) =>
        !["string", "number", "boolean"].includes(typeof item) || (typeof item === "number" && !Number.isFinite(item)),
    )
  ) {
    throw invalid(`result.metadata.${key} must contain limited scalar values`);
  }
}

function validateResultMetadata(definition: UnifiedResultContract, metadata: Record<string, unknown>) {
  const fields = new Map(definition.output.metadata.fields.map((field: MetadataField) => [field.key, field]));
  const unknownMetadataKeys = Object.keys(metadata).filter((key: string) => !fields.has(key));
  if (!definition.output.metadata.additionalProperties && unknownMetadataKeys.length) {
    throw invalid(`result.metadata contains undeclared fields: ${unknownMetadataKeys.join(", ")}`);
  }
  for (const key of unknownMetadataKeys) {
    validateAdditionalMetadata(metadata[key], key);
  }
  for (const field of fields.values()) validateField(metadata[field.key], field);
  for (const series of definition.presentation.series) validateSeries(metadata, series);
}

export function validateUnifiedMonitoringTemplateResult(definition: UnifiedResultContract, value: unknown) {
  if (!isRecord(value)) {
    throw invalid("JSONata must produce a single result object");
  }
  const unknownResultKeys = Object.keys(value).filter(
    (key: string) => !["status", "message", "metadata"].includes(key),
  );
  if (unknownResultKeys.length) {
    throw invalid(`result contains unsupported fields: ${unknownResultKeys.join(", ")}`);
  }
  const { output } = definition;
  if (!(typeof value.status === "string" && output.status.enum.includes(value.status))) {
    throw invalid("result.status is not supported by the template contract");
  }
  if (value.message === undefined && output.message.required) {
    throw invalid("result.message is required");
  }
  if (
    value.message !== undefined &&
    (typeof value.message !== "string" || value.message.length > output.message.maxLength)
  ) {
    throw invalid(`result.message must be a string with at most ${output.message.maxLength} characters`);
  }
  const metadata = value.metadata ?? (output.metadata.required ? undefined : {});
  if (!isRecord(metadata)) {
    throw invalid("result.metadata must be an object");
  }
  validateResultMetadata(definition, metadata);
  const normalized = {
    status: value.status,
    message: value.message || "",
    metadata,
  };
  if (Buffer.byteLength(JSON.stringify(normalized), "utf8") > 65_536) {
    throw invalid("result exceeds the 65536 byte limit");
  }
  return normalized;
}
