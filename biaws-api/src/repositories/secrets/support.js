export function secretError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function normalizedName(value) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function requiredText(value, field, maxLength) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maxLength) {
    throw secretError(
      422,
      "INVALID_SECRET",
      `${field} must contain between 1 and ${maxLength} characters`,
    );
  }
  return normalized;
}

export function optionalText(value, field, maxLength) {
  const normalized = String(value || "").trim();
  if (normalized.length > maxLength) {
    throw secretError(
      422,
      "INVALID_SECRET",
      `${field} must contain at most ${maxLength} characters`,
    );
  }
  return normalized;
}

export function duplicateSecretError(error) {
  if (error?.code !== 11000) throw error;
  if (error?.keyPattern?.identifier) {
    throw secretError(
      409,
      "SECRET_IDENTIFIER_CONFLICT",
      "A secret with this identifier already exists in the workspace",
    );
  }
  throw secretError(
    409,
    "SECRET_NAME_CONFLICT",
    "A secret with this name already exists in the selected scope",
  );
}
