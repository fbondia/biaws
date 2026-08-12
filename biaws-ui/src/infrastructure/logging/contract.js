function noop() {}

export function defineLoggingAdapter({
  dispose,
  initialize = noop,
  log = noop,
} = {}) {
  return Object.freeze({ dispose, initialize, log });
}
