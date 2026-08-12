import { defineSessionAdapter } from "./contract.js";
import { createHttpSessionAdapter } from "./httpAdapter.js";
import { clearSessionScopedState } from "./scopedState.js";
import { createSessionService } from "./service.js";

export const defaultSessionService = createSessionService({
  adapter: createHttpSessionAdapter(),
  clearSensitiveState: clearSessionScopedState,
});

let bootstrapConsumers = 0;

export const defaultSessionBootstrapAdapter = defineSessionAdapter({
  async dispose() {
    bootstrapConsumers = Math.max(0, bootstrapConsumers - 1);
    if (bootstrapConsumers === 0) {
      await defaultSessionService.dispose();
    }
  },
  async initialize() {
    bootstrapConsumers += 1;
    await defaultSessionService.initialize();
    return defaultSessionService;
  },
});
