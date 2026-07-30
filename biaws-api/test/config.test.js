import assert from "node:assert/strict";
import test from "node:test";

import { getServerConfig } from "../src/config.js";

const MANAGED_KEYS = [
  "NODE_ENV",
  "BETTER_AUTH_SECURE_COOKIES",
  "ISSUE_API_LOG_HEALTH_REQUESTS",
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

    const config = getServerConfig();
    assert.equal(config.auth.secureCookies, true);
    assert.equal(config.logging.includeHealthChecks, false);
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
