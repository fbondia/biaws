export function createCatalogError(
  statusCode: number | undefined,
  code: string | number | undefined,
  message: string | undefined,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function duplicateKeyError(
  error: unknown,
  code: string,
  message: string,
): never {
  if (!(
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 11000
  ))
    throw error;
  throw createCatalogError(409, code, message);
}
