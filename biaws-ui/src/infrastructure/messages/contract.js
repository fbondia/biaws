function noop() {}

export const MESSAGE_LEVEL = Object.freeze({
  ERROR: "error",
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
});

export const MESSAGE_DIALOG = Object.freeze({
  CONFIRM: "confirm",
  PROMPT: "prompt",
});

export function defineMessagesAdapter({ dispose, initialize = noop } = {}) {
  return Object.freeze({ dispose, initialize });
}
