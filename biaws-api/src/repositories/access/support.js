import { ObjectId } from "mongodb";

export function createHttpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function normalizedName(name) {
  return name.trim().toLocaleLowerCase("pt-BR");
}

export function compareStrings(left, right) {
  return String(left).localeCompare(String(right));
}

export function identityIdCandidates(userId) {
  const candidates = [userId];
  if (ObjectId.isValid(userId)) candidates.push(new ObjectId(userId));
  return candidates;
}

export function groupIdCandidates(groupIds) {
  return [...new Set(groupIds.map(String))].flatMap((groupId) =>
    ObjectId.isValid(groupId) ? [groupId, new ObjectId(groupId)] : [groupId],
  );
}
