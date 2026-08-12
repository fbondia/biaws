function noop() {}

export function defineMessagesAdapter({
  dispose,
  error = noop,
  info = noop,
  initialize = noop,
  success = noop,
  warning = noop,
} = {}) {
  return Object.freeze({
    dispose,
    error,
    info,
    initialize,
    success,
    warning,
  });
}
