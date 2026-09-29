import { ObjectId } from "mongodb";

export function createHttpError(
  statusCode: number | undefined,
  code: string | number | undefined,
  message: string | undefined,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function normalizedName(name: string) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

export function compareStrings(left: unknown, right: unknown) {
  return String(left).localeCompare(String(right));
}

export function identityIdCandidates(userId: string) {
  const candidates: (string | ObjectId)[] = [userId];
  if (ObjectId.isValid(userId)) candidates.push(new ObjectId(userId));
  return candidates;
}

export function groupIdCandidates(
  groupIds: readonly unknown[],
): (string | ObjectId)[] {
  return [...new Set(groupIds.map(String))].flatMap((groupId) =>
    ObjectId.isValid(groupId) ? [groupId, new ObjectId(groupId)] : [groupId],
  );
}
