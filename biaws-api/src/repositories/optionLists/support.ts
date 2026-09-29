export function createHttpError(
  statusCode: number | undefined,
  message: string | undefined,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
