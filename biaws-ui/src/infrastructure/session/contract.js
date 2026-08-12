function noop() {}

export function defineSessionAdapter({
  dispose,
  initialize = noop,
  restore = noop,
  signIn = noop,
  signOut = noop,
} = {}) {
  return Object.freeze({ dispose, initialize, restore, signIn, signOut });
}
