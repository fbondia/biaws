import { getServerConfig } from "../config.js";
import { LocalSecretProvider } from "./localSecretProvider.js";

let provider;

export function createSecretProvider(config = getServerConfig().secrets) {
  if (config.provider !== "local") {
    const error = new Error(
      `Unsupported secrets provider: ${config.provider || "missing"}`,
    );
    error.code = "UNSUPPORTED_SECRETS_PROVIDER";
    throw error;
  }
  return new LocalSecretProvider(config.local);
}

export function getSecretProvider() {
  if (!provider) provider = createSecretProvider();
  return provider;
}
