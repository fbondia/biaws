import assert from "node:assert/strict";
import test from "node:test";

import { getServerConfig } from "../src/config.js";

const MANAGED_KEYS = [
  "NODE_ENV",
  "BETTER_AUTH_SECURE_COOKIES",
  "ISSUE_API_LOG_HEALTH_REQUESTS",
  "ISSUE_API_RATE_LIMIT_ENABLED",
  "ISSUE_API_RATE_LIMIT_WINDOW_SECONDS",
  "ISSUE_API_RATE_LIMIT_MAX_REQUESTS",
  "BETTER_AUTH_RATE_LIMIT_ENABLED",
  "BETTER_AUTH_RATE_LIMIT_WINDOW_SECONDS",
  "BETTER_AUTH_RATE_LIMIT_MAX_REQUESTS",
  "ISSUE_API_KEY_RATE_LIMIT_ENABLED",
  "ISSUE_API_KEY_RATE_LIMIT_WINDOW_SECONDS",
  "ISSUE_API_KEY_RATE_LIMIT_MAX_REQUESTS",
  "BETTER_AUTH_TRUSTED_PROXIES",
  "BIAWS_SECRETS_DIR",
  "BIAWS_SECRET_FILES_PATH",
  "BIAWS_SECRETS_KEY_FILE",
  "BIAWS_SECRETS_KEY_PATH",
  "BIAWS_SECRETS_MAX_FILE_BYTES",
];

function preserveEnvironment() {
  const previous = Object.fromEntries(
    MANAGED_KEYS.map((key) => [key, process.env[key]]),
  );
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

test("production defaults to secure cookies and quiet health checks", () => {
  const restore = preserveEnvironment();
  try {
    process.env.NODE_ENV = "production";
    delete process.env.BETTER_AUTH_SECURE_COOKIES;
    delete process.env.ISSUE_API_LOG_HEALTH_REQUESTS;
    for (const key of MANAGED_KEYS.filter((key) =>
      key.includes("RATE_LIMIT"),
    )) {
      delete process.env[key];
    }

    const config = getServerConfig();
    assert.equal(config.auth.secureCookies, true);
    assert.equal(config.logging.includeHealthChecks, false);
    assert.deepEqual(config.rateLimit.api, {
      enabled: true,
      windowSeconds: 60,
      maxRequests: 300,
    });
    assert.deepEqual(config.rateLimit.auth, {
      enabled: true,
      windowSeconds: 10,
      maxRequests: 100,
    });
    assert.deepEqual(config.rateLimit.apiKey, {
      enabled: true,
      windowSeconds: 3600,
      maxRequests: 1000,
    });
  } finally {
    restore();
  }
});

test("boolean settings accept explicit operational overrides", () => {
  const restore = preserveEnvironment();
  try {
    process.env.NODE_ENV = "production";
    process.env.BETTER_AUTH_SECURE_COOKIES = "false";
    process.env.ISSUE_API_LOG_HEALTH_REQUESTS = "yes";

    const config = getServerConfig();
    assert.equal(config.auth.secureCookies, false);
    assert.equal(config.logging.includeHealthChecks, true);
  } finally {
    restore();
  }
});

test("invalid boolean settings fail fast", () => {
  const restore = preserveEnvironment();
  try {
    process.env.BETTER_AUTH_SECURE_COOKIES = "sometimes";
    assert.throws(
      () => getServerConfig(),
      /Invalid boolean environment value/u,
    );
  } finally {
    restore();
  }
});

test("rate limit settings accept explicit overrides", () => {
  const restore = preserveEnvironment();
  try {
    process.env.ISSUE_API_RATE_LIMIT_ENABLED = "false";
    process.env.ISSUE_API_RATE_LIMIT_WINDOW_SECONDS = "30";
    process.env.ISSUE_API_RATE_LIMIT_MAX_REQUESTS = "42";
    process.env.BETTER_AUTH_TRUSTED_PROXIES = "10.0.0.0/8,127.0.0.1";

    const config = getServerConfig();
    assert.deepEqual(config.rateLimit.api, {
      enabled: false,
      windowSeconds: 30,
      maxRequests: 42,
    });
    assert.deepEqual(config.auth.trustedProxies, ["10.0.0.0/8", "127.0.0.1"]);
  } finally {
    restore();
  }
});

test("instance host paths take precedence for local secret access", () => {
  const restore = preserveEnvironment();
  try {
    process.env.BIAWS_SECRETS_DIR = "/fallback/secrets";
    process.env.BIAWS_SECRET_FILES_PATH = "/instance/secrets";
    process.env.BIAWS_SECRETS_KEY_FILE = "/fallback/master.key";
    process.env.BIAWS_SECRETS_KEY_PATH = "/instance/master.key";
    process.env.BIAWS_SECRETS_MAX_FILE_BYTES = "1048576";

    const config = getServerConfig();
    assert.equal(config.secrets.local.directory, "/instance/secrets");
    assert.equal(config.secrets.local.keyFile, "/instance/master.key");
    assert.equal(config.secrets.maxFileBytes, 1048576);
    assert.equal(config.secrets.local.maxBytes, 1048576);
  } finally {
    restore();
  }
});
