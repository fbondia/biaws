import { RUNTIME_STATUSES } from "../../../shared/index.js";
import {
  assertAllowedFields,
  createCatalogError,
  normalizeEnum,
  normalizeMetadata,
  optionalText,
  requiredText,
} from "./topologyRepositorySupport.js";
import {
  isUnifiedMonitoringTemplateDefinition,
  normalizeUnifiedMonitoringTemplateDefinition,
} from "./monitoringTemplateUnifiedDefinition.js";

const RESULT_STATUSES = RUNTIME_STATUSES.filter(
  (status) => status !== "archived",
);
const MATCH_MODES = ["all", "any"];
const OPERATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "contains",
  "exists",
  "matches",
];
const PATH_PATTERN =
  /^(?:evidence|metadata|context)(?:\.[A-Za-z0-9_-]+){0,8}$/u;
const PROHIBITED_KEY =
  /(?:password|passwd|pwd|secret|token|credential|authorization|api[-_.]?key|private[-_.]?key|kubeconfig|connection[-_.]?string)/iu;
const TEMPLATE_PATTERN =
  /\{\{\s*((?:evidence|metadata|context)(?:\.[A-Za-z0-9_-]+){0,8})\s*\}\}/gu;

function invalid(message) {
  return createCatalogError(422, "INVALID_MONITORING_TEMPLATE", message);
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
    if (value.length > 8_000)
      throw invalid(`${field} contains a string that is too long`);
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
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u.test(key) ||
      PROHIBITED_KEY.test(key) ||
      ["constructor", "prototype", "__proto__"].includes(key.toLowerCase())
    ) {
      throw invalid(`${field} contains an invalid or sensitive key: ${key}`);
    }
    result[key] = safeJson(item, `${field}.${key}`, depth + 1, state);
  }
  return result;
}

function normalizeResult(value, field) {
  assertAllowedFields(value, ["status", "message", "metadata"], field);
  return {
    status: normalizeEnum(value.status, `${field}.status`, RESULT_STATUSES),
    message: optionalText(value.message, `${field}.message`, 2_000),
    metadata: normalizeMetadata(value.metadata ?? {}),
  };
}

function normalizeCondition(value, field) {
  assertAllowedFields(value, ["path", "operator", "value"], field);
  const path = requiredText(value.path, `${field}.path`, 180);
  if (
    !PATH_PATTERN.test(path) ||
    path.split(".").some((part) => PROHIBITED_KEY.test(part))
  ) {
    throw invalid(
      `${field}.path must reference a safe evidence, metadata or context field`,
    );
  }
  const operator = normalizeEnum(
    value.operator,
    `${field}.operator`,
    OPERATORS,
  );
  if (operator !== "exists" && !Object.hasOwn(value, "value")) {
    throw invalid(`${field}.value is required for ${operator}`);
  }
  const normalized = { path, operator };
  if (Object.hasOwn(value, "value")) {
    normalized.value = safeJson(value.value, `${field}.value`);
  }
  if (operator === "matches") {
    if (typeof normalized.value !== "string" || normalized.value.length > 200) {
      throw invalid(
        `${field}.value must be a regular expression with at most 200 characters`,
      );
    }
    try {
      new RegExp(normalized.value, "u");
    } catch {
      throw invalid(`${field}.value must be a valid regular expression`);
    }
  }
  return normalized;
}

function normalizeRule(value, index) {
  const field = `definition.rules[${index}]`;
  assertAllowedFields(value, ["label", "match", "conditions", "result"], field);
  if (
    !Array.isArray(value.conditions) ||
    !value.conditions.length ||
    value.conditions.length > 20
  ) {
    throw invalid(
      `${field}.conditions must contain between 1 and 20 conditions`,
    );
  }
  return {
    label:
      optionalText(value.label, `${field}.label`, 160) || `Regra ${index + 1}`,
    match: normalizeEnum(value.match, `${field}.match`, MATCH_MODES, "all"),
    conditions: value.conditions.map((condition, conditionIndex) =>
      normalizeCondition(condition, `${field}.conditions[${conditionIndex}]`),
    ),
    result: normalizeResult(value.result, `${field}.result`),
  };
}

export function normalizeMonitoringTemplateDefinition(value = {}) {
  if (isUnifiedMonitoringTemplateDefinition(value)) {
    return normalizeUnifiedMonitoringTemplateDefinition(value);
  }
  assertAllowedFields(value, ["rules", "defaultResult"], "template definition");
  if (
    !Array.isArray(value.rules) ||
    !value.rules.length ||
    value.rules.length > 20
  ) {
    throw invalid("definition.rules must contain between 1 and 20 rules");
  }
  return {
    rules: value.rules.map(normalizeRule),
    defaultResult: normalizeResult(
      value.defaultResult || {
        status: "unknown",
        message: "Nenhuma regra correspondeu.",
        metadata: {},
      },
      "definition.defaultResult",
    ),
  };
}

export function sanitizeMonitoringTemplateSample(value = {}) {
  return safeJson(value, "sample");
}

function valueAtPath(sample, path) {
  return path.split(".").reduce((current, segment) => {
    if (
      !current ||
      typeof current !== "object" ||
      !Object.hasOwn(current, segment)
    )
      return undefined;
    return current[segment];
  }, sample);
}

function compare(actual, condition) {
  const expected = condition.value;
  switch (condition.operator) {
    case "equals":
      return actual === expected;
    case "not_equals":
      return actual !== expected;
    case "greater_than":
      return (
        typeof actual === "number" &&
        typeof expected === "number" &&
        actual > expected
      );
    case "greater_than_or_equal":
      return (
        typeof actual === "number" &&
        typeof expected === "number" &&
        actual >= expected
      );
    case "less_than":
      return (
        typeof actual === "number" &&
        typeof expected === "number" &&
        actual < expected
      );
    case "less_than_or_equal":
      return (
        typeof actual === "number" &&
        typeof expected === "number" &&
        actual <= expected
      );
    case "contains":
      return typeof actual === "string"
        ? actual.includes(String(expected))
        : Array.isArray(actual) && actual.includes(expected);
    case "exists":
      return condition.value === false
        ? actual === undefined
        : actual !== undefined;
    case "matches":
      return (
        typeof actual === "string" && new RegExp(expected, "u").test(actual)
      );
    default:
      return false;
  }
}

function renderMessage(message, sample) {
  return message.replace(TEMPLATE_PATTERN, (_match, path) => {
    const value = valueAtPath(sample, path);
    return value === undefined || value === null
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  });
}

export function evaluateMonitoringTemplate(definition, rawSample = {}) {
  if (isUnifiedMonitoringTemplateDefinition(definition)) {
    normalizeUnifiedMonitoringTemplateDefinition(definition);
    throw invalid(
      "JSONata template evaluation is not available in this implementation phase",
    );
  }
  const normalizedDefinition =
    normalizeMonitoringTemplateDefinition(definition);
  const sample = sanitizeMonitoringTemplateSample(rawSample);
  const diagnostics = [];
  let selected = null;
  normalizedDefinition.rules.some((rule, ruleIndex) => {
    const conditions = rule.conditions.map((condition) => {
      const actual = valueAtPath(sample, condition.path);
      return {
        path: condition.path,
        operator: condition.operator,
        matched: compare(actual, condition),
      };
    });
    const matched =
      rule.match === "all"
        ? conditions.every((condition) => condition.matched)
        : conditions.some((condition) => condition.matched);
    diagnostics.push({ rule: rule.label, ruleIndex, matched, conditions });
    if (matched) selected = { rule, ruleIndex };
    return matched;
  });
  const result = selected?.rule.result || normalizedDefinition.defaultResult;
  return {
    result: { ...result, message: renderMessage(result.message, sample) },
    matchedRule: selected
      ? { label: selected.rule.label, index: selected.ruleIndex }
      : null,
    diagnostics,
  };
}
