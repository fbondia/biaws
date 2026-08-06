import { deleteJson, fetchJson, sendJson } from "./client.js";

export function listPlatformWorkspaces(params) {
  return fetchJson("/api/platform/workspaces", params);
}

export function createPlatformWorkspace(payload) {
  return sendJson("/api/platform/workspaces", payload, undefined, "POST");
}

export function updatePlatformWorkspace(workspaceId, payload) {
  return sendJson(
    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}`,
    payload,
    undefined,
    "PATCH",
  );
}

export function archivePlatformWorkspace(workspaceId, confirmation) {
  return sendJson(
    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/archive`,
    { confirmation },
    undefined,
    "POST",
  );
}

export function reactivatePlatformWorkspace(workspaceId) {
  return sendJson(
    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/reactivate`,
    {},
    undefined,
    "POST",
  );
}

export function getPlatformWorkspaceSummary(workspaceId) {
  return fetchJson(
    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/summary`,
  );
}

export function listPlatformWorkspaceMembers(workspaceId) {
  return fetchJson(
    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/members`,
  );
}

export function listPlatformWorkspaceGroups(workspaceId) {
  return fetchJson(
    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/groups`,
  );
}

export function listPlatformWorkspaceAudit(workspaceId) {
  return fetchJson(
    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/audit`,
  );
}

export function listPlatformUsers() {
  return fetchJson("/api/platform/users");
}

export function setPlatformWorkspaceMember(workspaceId, userId, groupIds) {
  return sendJson(
    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
    { groupIds },
  );
}

export function removePlatformWorkspaceMember(workspaceId, userId) {
  return deleteJson(
    `/api/platform/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(userId)}`,
  );
}
