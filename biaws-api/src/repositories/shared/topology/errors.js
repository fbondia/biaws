export function createCatalogError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function duplicateKeyError(error, code, message) {
  if (error?.code !== 11000) throw error;
  throw createCatalogError(409, code, message);
}
