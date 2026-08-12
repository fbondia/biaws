import { deleteJson, fetchJson, sendJson } from "./client.js";

export function fetchCurrentActor() {
  return fetchJson("/api/auth/me");
}

export function signIn(email, password) {
  return sendJson(
    "/api/auth/sign-in/email",
    { email, password },
    undefined,
    "POST",
  );
}

export function signOut() {
  return sendJson("/api/auth/sign-out", {}, undefined, "POST");
}

export function listSessions() {
  return fetchJson("/api/auth/list-sessions");
}

export function revokeSession(token) {
  return sendJson("/api/auth/revoke-session", { token }, undefined, "POST");
}

export function revokeOtherSessions() {
  return sendJson("/api/auth/revoke-other-sessions", {}, undefined, "POST");
}

export function changePassword(currentPassword, newPassword) {
  return sendJson(
    "/api/auth/change-password",
    { currentPassword, newPassword, revokeOtherSessions: false },
    undefined,
    "POST",
  );
}

export function listApiKeys() {
  return fetchJson("/api/auth/api-key/list");
}

export function createApiKey(name) {
  return sendJson("/api/auth/api-key/create", { name }, undefined, "POST");
}

export function deleteApiKey(keyId) {
  return sendJson("/api/auth/api-key/delete", { keyId }, undefined, "POST");
}

export function listUsers() {
  return fetchJson("/api/identity/users");
}

export function createUser({ name, email, password }) {
  return sendJson(
    "/api/identity/users",
    { name, email, password },
    undefined,
    "POST",
  );
}

export function setUserDisabled(userId, disabled) {
  return sendJson(
    `/api/identity/users/${encodeURIComponent(userId)}/disabled`,
    { disabled },
    undefined,
    "PATCH",
  );
}

export function resetUserPassword(userId, newPassword) {
  return sendJson(
    `/api/identity/users/${encodeURIComponent(userId)}/password`,
    { newPassword },
    undefined,
    "PUT",
  );
}

export function revokeUserSessions(userId) {
  return deleteJson(
    `/api/identity/users/${encodeURIComponent(userId)}/sessions`,
  );
}

export function listPermissionCatalog() {
  return fetchJson("/api/access/permissions");
}

export function listPermissionGroups() {
  return fetchJson("/api/access/groups");
}

export function createPermissionGroup(group) {
  return sendJson("/api/access/groups", group, undefined, "POST");
}

export function replicatePermissionGroup(groupId, destinationWorkspaceIds) {
  return sendJson(
    `/api/access/groups/${encodeURIComponent(groupId)}/replicate`,
    Array.isArray(destinationWorkspaceIds)
      ? { destinationWorkspaceIds }
      : { destinationWorkspaceId: destinationWorkspaceIds },
    undefined,
    "POST",
  );
}

export function updatePermissionGroup(groupId, group) {
  return sendJson(`/api/access/groups/${encodeURIComponent(groupId)}`, group);
}

export function setPermissionGroupActive(groupId, active) {
  return sendJson(
    `/api/access/groups/${encodeURIComponent(groupId)}/status`,
    { active },
    undefined,
    "PATCH",
  );
}

export function getUserAccess(userId) {
  return fetchJson(`/api/access/users/${encodeURIComponent(userId)}`);
}

export function setUserGroups(userId, groupIds) {
  return sendJson(`/api/access/users/${encodeURIComponent(userId)}/groups`, {
    groupIds,
  });
}
