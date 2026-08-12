import { createMessagesService } from "./service.js";

export function createMessagesTestService() {
  const scheduled = new Map();
  let nextTimerId = 0;
  const service = createMessagesService({
    clearTimeoutFn: (id) => scheduled.delete(id),
    setTimeoutFn: (callback) => {
      const id = ++nextTimerId;
      scheduled.set(id, callback);
      return id;
    },
  });

  return Object.freeze({
    flushTimers() {
      const callbacks = [...scheduled.values()];
      scheduled.clear();
      for (const callback of callbacks) callback();
    },
    service,
  });
}
