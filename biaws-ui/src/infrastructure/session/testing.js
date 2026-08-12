import { defineSessionAdapter } from "./contract.js";

export function createFakeSessionAdapter({
  actor = null,
  restoreError = null,
  signInError = null,
  signOutError = null,
  workspaceId = "",
} = {}) {
  let currentActor = actor;
  let currentRestoreError = restoreError;
  let onUnauthorized = () => {};
  let selectedWorkspaceId = workspaceId;
  const calls = [];

  const adapter = defineSessionAdapter({
    dispose() {
      calls.push(["dispose"]);
      onUnauthorized = () => {};
    },
    getWorkspaceId() {
      return selectedWorkspaceId;
    },
    initialize(options = {}) {
      calls.push(["initialize"]);
      onUnauthorized = options.onUnauthorized || (() => {});
    },
    async restore() {
      calls.push(["restore", selectedWorkspaceId]);
      const error =
        typeof currentRestoreError === "function"
          ? currentRestoreError(selectedWorkspaceId)
          : currentRestoreError;
      if (error) throw error;
      return currentActor;
    },
    setWorkspaceId(nextWorkspaceId) {
      selectedWorkspaceId = String(nextWorkspaceId || "").trim();
      calls.push(["setWorkspaceId", selectedWorkspaceId]);
    },
    async signIn(credentials) {
      calls.push(["signIn", credentials]);
      if (signInError) throw signInError;
    },
    async signOut() {
      calls.push(["signOut"]);
      if (signOutError) throw signOutError;
    },
  });

  return Object.freeze({
    adapter,
    calls,
    expire(reason = "Session expired") {
      onUnauthorized({ reason, statusCode: 401 });
    },
    setActor(nextActor) {
      currentActor = nextActor;
    },
    setRestoreError(error) {
      currentRestoreError = error;
    },
  });
}
