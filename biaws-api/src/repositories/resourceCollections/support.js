export function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function workspaceId(query = {}) {
  return String(
    query.authorizationScope?.workspaceId || query.workspaceId || "",
  );
}

export function duplicateError(error) {
  if (error?.code === 11000) {
    throw httpError(
      409,
      "COLLECTION_NAME_CONFLICT",
      "Já existe uma coleção com este nome no local selecionado",
    );
  }
  throw error;
}
