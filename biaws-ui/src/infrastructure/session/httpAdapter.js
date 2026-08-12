import {
  fetchCurrentActor,
  signIn as requestSignIn,
  signOut as requestSignOut,
} from "../../api/auth.js";
import { configureApiSession } from "../../api/client.js";
import { defineSessionAdapter } from "./contract.js";

const WORKSPACE_STORAGE_KEY = "biaws.currentWorkspaceId";

function defaultStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function createHttpSessionAdapter({
  authApi = {
    fetchCurrentActor,
    signIn: requestSignIn,
    signOut: requestSignOut,
  },
  configureClient = configureApiSession,
  storage = defaultStorage(),
} = {}) {
  let disconnectClient;
  let workspaceId = String(
    storage?.getItem?.(WORKSPACE_STORAGE_KEY) || "",
  ).trim();

  function setWorkspaceId(nextWorkspaceId) {
    workspaceId = String(nextWorkspaceId || "").trim();
    if (workspaceId) {
      storage?.setItem?.(WORKSPACE_STORAGE_KEY, workspaceId);
    } else {
      storage?.removeItem?.(WORKSPACE_STORAGE_KEY);
    }
  }

  return defineSessionAdapter({
    dispose() {
      disconnectClient?.();
      disconnectClient = undefined;
    },
    getWorkspaceId() {
      return workspaceId;
    },
    initialize({ onUnauthorized } = {}) {
      disconnectClient?.();
      disconnectClient = configureClient({
        getWorkspaceId: () => workspaceId,
        onUnauthorized,
      });
    },
    async restore() {
      const payload = await authApi.fetchCurrentActor();
      return payload?.actor || null;
    },
    setWorkspaceId,
    async signIn({ email, password }) {
      await authApi.signIn(email, password);
    },
    async signOut() {
      await authApi.signOut();
    },
  });
}
