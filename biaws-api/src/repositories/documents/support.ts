export function httpError(
  statusCode: number | undefined,
  code: string | number | undefined,
  message: string | undefined,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function normalizeDate(
  value: unknown,
  field: string,
  { required = false } = {},
) {
  const normalized = String(value || "").trim();
  if (!normalized && !required) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DATE",
      `${field} deve usar YYYY-MM-DD`,
    );
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DATE",
      `${field} contém uma data inválida`,
    );
  }
  return normalized;
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function shortText(value: unknown, field: string, maximum = 120) {
  const normalized = String(value || "").trim();
  if (normalized.length > maximum) {
    throw httpError(
      422,
      "INVALID_DOCUMENT_DETAILS",
      `${field} deve ter até ${maximum} caracteres`,
    );
  }
  return normalized;
}

export function enumValue(
  value: unknown,
  field: string,
  values: string | string[],
  fallback = "",
) {
  const normalized = String(value || fallback).trim();
  if (!values.includes(normalized)) {
    throw httpError(422, "INVALID_DOCUMENT_DETAILS", `${field} é inválido`);
  }
  return normalized;
}
