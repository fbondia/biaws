import { createLocalAttachmentStorage } from "./localAttachmentStorage.js";

const SUPPORTED_PROVIDERS = new Set(["local"]);

function readOption(options: Record<string, unknown>, key: string) {
  return (
    options?.[key] ??
    options?.[key.replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase())]
  );
}

function readProvider(options: Record<string, unknown>) {
  return String(
    readOption(options, "attachment-storage-provider") ||
      process.env.ATTACHMENT_STORAGE_PROVIDER ||
      "local",
  )
    .trim()
    .toLowerCase();
}

export function createAttachmentStorage(options: object = {}) {
  const provider = readProvider(options as Record<string, unknown>);

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new Error(
      `Unsupported attachment storage provider: ${provider}. Supported providers: ${[
        ...SUPPORTED_PROVIDERS,
      ].join(", ")}`,
    );
  }

  return createLocalAttachmentStorage(options as Record<string, unknown>);
}
