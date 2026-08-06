import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const FORMAT_VERSION = 1;
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const MAX_SECRET_BYTES = 64 * 1024;
const DEFAULT_MAX_CONTENT_BYTES = 5 * 1024 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/u;

function providerError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  error.statusCode = code === "SECRET_NOT_FOUND" ? 404 : 500;
  return error;
}

function validateIdentifier(value, field) {
  const normalized = String(value || "");
  if (!ID_PATTERN.test(normalized)) {
    throw providerError(
      "INVALID_SECRET_CONTEXT",
      `${field} is invalid for local secret storage`,
    );
  }
  return normalized;
}

function versionNumber(value) {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw providerError(
      "INVALID_SECRET_CONTEXT",
      "version must be a positive integer",
    );
  }
  return version;
}

function associatedData({ workspaceId, secretId, version }) {
  return Buffer.from(
    JSON.stringify({
      workspaceId: validateIdentifier(workspaceId, "workspaceId"),
      secretId: validateIdentifier(secretId, "secretId"),
      version: versionNumber(version),
    }),
    "utf8",
  );
}

function locatorFor(secretId, version) {
  return `${validateIdentifier(secretId, "secretId")}/version-${versionNumber(version)}.enc`;
}

function validateEnvelope(envelope) {
  if (
    !envelope ||
    envelope.format !== FORMAT_VERSION ||
    envelope.algorithm !== ALGORITHM ||
    typeof envelope.nonce !== "string" ||
    typeof envelope.ciphertext !== "string" ||
    typeof envelope.authTag !== "string"
  ) {
    throw providerError(
      "INVALID_SECRET_ENVELOPE",
      "The encrypted secret file has an unsupported or invalid format",
    );
  }
}

export class LocalSecretProvider {
  constructor({ directory, keyFile, maxBytes = DEFAULT_MAX_CONTENT_BYTES }) {
    this.directory = path.resolve(directory);
    this.keyFile = path.resolve(keyFile);
    this.maxBytes = maxBytes;
    this.keyPromise = null;
  }

  async encryptionKey() {
    if (!this.keyPromise) {
      this.keyPromise = readFile(this.keyFile).then((key) => {
        if (key.length !== KEY_BYTES) {
          throw providerError(
            "INVALID_SECRETS_MASTER_KEY",
            `The local secrets master key must contain exactly ${KEY_BYTES} bytes`,
          );
        }
        return key;
      });
    }
    return this.keyPromise;
  }

  resolveLocator(locator) {
    const normalized = String(locator || "");
    const match = normalized.match(
      /^([A-Za-z0-9_-]{1,128})\/version-([1-9][0-9]*)\.enc$/u,
    );
    if (!match) {
      throw providerError(
        "INVALID_SECRET_LOCATOR",
        "The local secret locator is invalid",
      );
    }
    const resolved = path.resolve(this.directory, normalized);
    if (!resolved.startsWith(`${this.directory}${path.sep}`)) {
      throw providerError(
        "INVALID_SECRET_LOCATOR",
        "The local secret locator escapes the vault directory",
      );
    }
    return resolved;
  }

  async putValue(context, value) {
    if (typeof value !== "string" || !value.length) {
      const error = new Error("Secret value must be a non-empty string");
      error.code = "INVALID_SECRET_VALUE";
      error.statusCode = 422;
      throw error;
    }
    const plaintext = Buffer.from(value, "utf8");
    if (plaintext.length > MAX_SECRET_BYTES) {
      plaintext.fill(0);
      const error = new Error(
        `Secret value must contain at most ${MAX_SECRET_BYTES} bytes`,
      );
      error.code = "INVALID_SECRET_VALUE";
      error.statusCode = 422;
      throw error;
    }

    try {
      return await this.putContent(context, plaintext, {
        maxBytes: MAX_SECRET_BYTES,
      });
    } finally {
      plaintext.fill(0);
    }
  }

  async putContent(context, content, { maxBytes = this.maxBytes } = {}) {
    if (!Buffer.isBuffer(content) && !(content instanceof Uint8Array)) {
      const error = new Error("Secret content must be binary data");
      error.code = "INVALID_SECRET_VALUE";
      error.statusCode = 422;
      throw error;
    }
    const plaintext = Buffer.from(content);
    if (!plaintext.length || plaintext.length > maxBytes) {
      plaintext.fill(0);
      const error = new Error(
        `Secret content must contain between 1 and ${maxBytes} bytes`,
      );
      error.code = "INVALID_SECRET_VALUE";
      error.statusCode = 422;
      throw error;
    }

    const version = versionNumber(context.version);
    const locator = locatorFor(context.secretId, version);
    const destination = this.resolveLocator(locator);
    const directory = path.dirname(destination);
    const temporary = path.join(directory, `.${randomUUID()}.tmp`);
    const nonce = randomBytes(NONCE_BYTES);

    try {
      const cipher = createCipheriv(
        ALGORITHM,
        await this.encryptionKey(),
        nonce,
      );
      cipher.setAAD(associatedData(context));
      const ciphertext = Buffer.concat([
        cipher.update(plaintext),
        cipher.final(),
      ]);
      const envelope = {
        format: FORMAT_VERSION,
        algorithm: ALGORITHM,
        keyId: "local-v1",
        nonce: nonce.toString("base64"),
        ciphertext: ciphertext.toString("base64"),
        authTag: cipher.getAuthTag().toString("base64"),
        createdAt: new Date().toISOString(),
      };
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(temporary, `${JSON.stringify(envelope)}\n`, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await link(temporary, destination);
      await unlink(temporary).catch(() => {});
      return { locator };
    } catch (error) {
      await unlink(temporary).catch(() => {});
      if (error?.code === "EEXIST") {
        throw providerError(
          "SECRET_VERSION_CONFLICT",
          "The encrypted secret version already exists",
          error,
        );
      }
      throw error;
    } finally {
      plaintext.fill(0);
    }
  }

  async getValue(context, locator) {
    const plaintext = await this.getContent(context, locator);
    try {
      return plaintext.toString("utf8");
    } finally {
      plaintext.fill(0);
    }
  }

  async getContent(context, locator) {
    const filePath = this.resolveLocator(locator);
    let envelope;
    try {
      envelope = JSON.parse(await readFile(filePath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw providerError(
          "SECRET_NOT_FOUND",
          "The encrypted secret value was not found",
          error,
        );
      }
      if (error instanceof SyntaxError) {
        throw providerError(
          "INVALID_SECRET_ENVELOPE",
          "The encrypted secret file is not valid JSON",
          error,
        );
      }
      throw error;
    }
    validateEnvelope(envelope);

    try {
      const decipher = createDecipheriv(
        ALGORITHM,
        await this.encryptionKey(),
        Buffer.from(envelope.nonce, "base64"),
      );
      decipher.setAAD(associatedData(context));
      decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(envelope.ciphertext, "base64")),
        decipher.final(),
      ]);
      return plaintext;
    } catch (error) {
      throw providerError(
        "SECRET_DECRYPTION_FAILED",
        "The encrypted secret could not be authenticated or decrypted",
        error,
      );
    }
  }

  async deleteValue(locator) {
    const filePath = this.resolveLocator(locator);
    await unlink(filePath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
  }
}
