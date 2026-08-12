import { defineLoggingAdapter } from "../logging/contract.js";
import { defineMessagesAdapter } from "../messages/contract.js";
import { defaultSessionBootstrapAdapter } from "../session/runtime.js";

const defaultAdapters = Object.freeze({
  logging: defineLoggingAdapter(),
  messages: defineMessagesAdapter(),
  session: defaultSessionBootstrapAdapter,
});

function lifecycleCapability({ critical, id, adapter }) {
  return Object.freeze({
    critical,
    dispose: adapter.dispose,
    id,
    initialize: adapter.initialize,
  });
}

export function createInfrastructureCapabilities(adapters = {}) {
  const logging = adapters.logging || defaultAdapters.logging;
  const session = adapters.session || defaultAdapters.session;
  const messages = adapters.messages || defaultAdapters.messages;

  return Object.freeze([
    lifecycleCapability({ critical: false, id: "logging", adapter: logging }),
    lifecycleCapability({ critical: true, id: "session", adapter: session }),
    lifecycleCapability({
      critical: false,
      id: "messages",
      adapter: messages,
    }),
  ]);
}

export const DEFAULT_INFRASTRUCTURE_CAPABILITIES =
  createInfrastructureCapabilities();
