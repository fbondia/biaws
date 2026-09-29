export function homeError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function hasPermission(actor, permission) {
  return actor?.permissions?.includes(permission) === true;
}
