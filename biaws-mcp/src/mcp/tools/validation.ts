import type { Schema, ToolDefinition } from "./contracts.js";
import { BiawsError } from "../../runtime/errors.js";
export interface ValidationField {
  path: string;
  code: string;
  message: string;
}
function valueMatchesType(
  value: unknown,
  type: string | readonly string[],
): boolean {
  if (Array.isArray(type))
    return type.some((candidate) => valueMatchesType(value, candidate));
  if (type === "null") return value === null;
  if (type === "object")
    return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number")
    return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function addValidationField(
  fields: ValidationField[],
  path: string,
  code: string,
  message: string,
) {
  fields.push({ path, code, message });
}

function validateSchemaType(
  value: unknown,
  schema: Schema | undefined,
  path: string,
  fields: ValidationField[],
): boolean {
  if (!schema?.type || valueMatchesType(value, schema.type)) return true;
  const expected = Array.isArray(schema.type)
    ? schema.type.join(" or ")
    : schema.type;
  addValidationField(
    fields,
    path,
    "invalid_type",
    `${path} must be of type ${expected}`,
  );
  return false;
}

function validateEnum(
  value: unknown,
  schema: Schema | undefined,
  path: string,
  fields: ValidationField[],
): void {
  if (schema?.enum && !schema.enum.includes(value)) {
    addValidationField(
      fields,
      path,
      "invalid_enum",
      `${path} must be one of ${schema.enum.join(", ")}`,
    );
  }
}

function validateConst(
  value: unknown,
  schema: Schema | undefined,
  path: string,
  fields: ValidationField[],
): void {
  if (schema && Object.hasOwn(schema, "const") && value !== schema.const) {
    addValidationField(
      fields,
      path,
      "invalid_const",
      `${path} must be ${JSON.stringify(schema.const)}`,
    );
  }
}

function validateString(
  value: unknown,
  schema: Schema | undefined,
  path: string,
  fields: ValidationField[],
): void {
  if (!schema || typeof value !== "string") return;
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    addValidationField(
      fields,
      path,
      "min_length",
      `${path} must contain at least ${schema.minLength} characters`,
    );
  }
  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    addValidationField(
      fields,
      path,
      "max_length",
      `${path} must contain at most ${schema.maxLength} characters`,
    );
  }
  if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) {
    addValidationField(
      fields,
      path,
      "pattern",
      `${path} must match ${schema.pattern}`,
    );
  }
}

function validateNumber(
  value: unknown,
  schema: Schema | undefined,
  path: string,
  fields: ValidationField[],
): void {
  if (!schema || typeof value !== "number") return;
  if (schema.minimum !== undefined && value < schema.minimum) {
    addValidationField(
      fields,
      path,
      "minimum",
      `${path} must be at least ${schema.minimum}`,
    );
  }
  if (schema.maximum !== undefined && value > schema.maximum) {
    addValidationField(
      fields,
      path,
      "maximum",
      `${path} must be at most ${schema.maximum}`,
    );
  }
}

function validateArray(
  value: unknown,
  schema: Schema | undefined,
  path: string,
  fields: ValidationField[],
): void {
  if (!schema || !Array.isArray(value)) return;
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    addValidationField(
      fields,
      path,
      "min_items",
      `${path} must contain at least ${schema.minItems} items`,
    );
  }
  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    addValidationField(
      fields,
      path,
      "max_items",
      `${path} must contain at most ${schema.maxItems} items`,
    );
  }
  for (const [index, entry] of value.entries()) {
    validateValue(entry, schema.items, `${path}[${index}]`, fields);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isObjectSchema(value: unknown): value is Schema {
  return Boolean(value) && typeof value === "object";
}

function validateRequiredProperties(
  value: Record<string, unknown>,
  schema: Schema,
  path: string,
  fields: ValidationField[],
) {
  for (const required of schema.required || []) {
    if (value[required] === undefined) {
      const requiredPath = path ? `${path}.${required}` : required;
      addValidationField(
        fields,
        requiredPath,
        "required",
        `${requiredPath} is required`,
      );
    }
  }
}

function validateObjectEntries(
  value: Record<string, unknown>,
  schema: Schema,
  path: string,
  fields: ValidationField[],
) {
  const properties = schema.properties || {};
  for (const [key, entry] of Object.entries(value)) {
    const entryPath = path ? `${path}.${key}` : key;
    if (properties[key]) {
      validateValue(entry, properties[key], entryPath, fields);
    } else if (schema.additionalProperties === false) {
      addValidationField(
        fields,
        entryPath,
        "additional_property",
        `${entryPath} is not supported`,
      );
    } else if (isObjectSchema(schema.additionalProperties)) {
      validateValue(entry, schema.additionalProperties, entryPath, fields);
    }
  }
}

function validateObject(
  value: unknown,
  schema: Schema | undefined,
  path: string,
  fields: ValidationField[],
): void {
  if (!schema || !isPlainObject(value)) return;
  validateRequiredProperties(value, schema, path, fields);
  validateObjectEntries(value, schema, path, fields);
}

function validateNot(
  value: unknown,
  schema: Schema | undefined,
  path: string,
  fields: ValidationField[],
): void {
  if (!schema?.not) return;
  const nestedFields: ValidationField[] = [];
  validateValue(value, schema.not, path, nestedFields);
  if (!nestedFields.length) {
    addValidationField(
      fields,
      path,
      "not",
      `${path || "arguments"} contains a forbidden combination of fields`,
    );
  }
}

function validateOneOf(
  value: unknown,
  schema: Schema | undefined,
  path: string,
  fields: ValidationField[],
): void {
  if (!schema?.oneOf?.length) return;
  const candidates = schema.oneOf.map((candidate) => {
    const candidateFields: ValidationField[] = [];
    validateValue(value, candidate, path, candidateFields);
    return candidateFields;
  });
  const matches = candidates.filter(
    (candidateFields) => !candidateFields.length,
  );
  if (matches.length === 1) return;
  if (!matches.length) {
    const discriminatedIndexes = schema.oneOf.flatMap((candidate, index) => {
      const matchesDiscriminator = Object.entries(
        candidate.properties || {},
      ).some(
        ([property, definition]) =>
          Object.hasOwn(definition, "const") &&
          isPlainObject(value) &&
          value[property] === definition.const,
      );
      return matchesDiscriminator ? [index] : [];
    });
    const eligible = discriminatedIndexes.length
      ? discriminatedIndexes.map((index) => candidates[index])
      : candidates;
    const best = eligible.reduce((selected, candidate) =>
      candidate.length < selected.length ? candidate : selected,
    );
    if (best.length) {
      fields.push(...best);
      return;
    }
  }
  addValidationField(
    fields,
    path,
    "one_of",
    `${path || "arguments"} must match exactly one supported schema variant`,
  );
}

function validateValue(
  value: unknown,
  schema: Schema | undefined,
  path: string,
  fields: ValidationField[],
): void {
  if (!schema || value === undefined) return;
  if (!validateSchemaType(value, schema, path, fields)) return;
  validateConst(value, schema, path, fields);
  validateEnum(value, schema, path, fields);
  validateString(value, schema, path, fields);
  validateNumber(value, schema, path, fields);
  validateArray(value, schema, path, fields);
  validateObject(value, schema, path, fields);
  validateNot(value, schema, path, fields);
  validateOneOf(value, schema, path, fields);
}

export function validateArguments(tool: ToolDefinition, args: unknown) {
  const fields: ValidationField[] = [];
  validateValue(args, tool.inputSchema, "", fields);
  if (!fields.length) return;

  const error = new BiawsError(fields.map(({ message }) => message).join("; "));
  error.code = "VALIDATION_ERROR";
  error.statusCode = 400;
  error.fields = fields;
  error.retryable = false;
  throw error;
}
