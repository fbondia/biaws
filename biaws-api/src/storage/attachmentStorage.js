import { createLocalAttachmentStorage } from "./localAttachmentStorage.js";

const SUPPORTED_PROVIDERS = new Set(["local"]);

function readOption(options, key) {
  return (
    options?.[key] ??
    options?.[key.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())]
  );
}

function readProvider(options) {
  return String(
    readOption(options, "attachment-storage-provider") ||
      process.env.ATTACHMENT_STORAGE_PROVIDER ||
      "local",
  )
    .trim()
    .toLowerCase();
}

export function createAttachmentStorage(options = {}) {
  const provider = readProvider(options);

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(
      `Unsupported attachment storage provider: ${provider}. Supported providers: ${[
        ...SUPPORTED_PROVIDERS,
      ].join(", ")}`,
    );
  }

  return createLocalAttachmentStorage(options);
}
