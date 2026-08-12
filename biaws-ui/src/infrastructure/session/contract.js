function noop() {}
function emptyWorkspaceId() {
  return "";
}

export function defineSessionAdapter({
  dispose,
  getWorkspaceId = emptyWorkspaceId,
  initialize = noop,
  restore = noop,
  setWorkspaceId = noop,
  signIn = noop,
  signOut = noop,
} = {}) {
  return Object.freeze({
    dispose,
    getWorkspaceId,
    initialize,
    restore,
    setWorkspaceId,
    signIn,
    signOut,
  });
}
