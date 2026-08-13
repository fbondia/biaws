import { constants as fsConstants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";

import {
  assertAllowedKeys,
  assertObject,
  boundedString,
  resolveInside,
  sanitizeEvidenceText,
  sensitiveValues,
  truncateText,
} from "./providerSupport.js";
import { ProviderConfigurationError } from "./providers.js";
import { executeShellProcess } from "./shellProcess.js";

const SCRIPT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u;
const ENVIRONMENT_NAME = /^[A-Z_][A-Z0-9_]{0,99}$/u;

export const SHELL_CONFIGURATION_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["scriptId"],
  properties: {
    scriptId: { type: "string", pattern: SCRIPT_ID.source },
    arguments: {
      type: "array",
      items: { type: "string", maxLength: 2_000 },
      maxItems: 32,
    },
    environment: {
      type: "object",
      additionalProperties: { type: "string", maxLength: 4_000 },
    },
    failureStatus: {
      type: "string",
      enum: ["unknown", "degraded", "unavailable"],
      default: "unavailable",
    },
    captureOutput: {
      type: "string",
      enum: ["none", "stdout", "stderr", "both"],
      default: "none",
    },
  },
});

function compilePattern(value, field) {
  try {
    return new RegExp(`^(?:${value})$`, "u");
  } catch {
    throw new Error(`${field} must be a valid regular expression`);
  }
}

function normalizeScriptPolicies(scripts) {
  assertObject(scripts, "shell scripts policy");
  return Object.fromEntries(
    Object.entries(scripts).map(([id, raw]) => {
      if (!SCRIPT_ID.test(id))
        throw new Error("Shell policy contains an invalid script identifier");
      assertObject(raw, `shell script policy ${id}`);
      assertAllowedKeys(
        raw,
        [
          "path",
          "workingDirectory",
          "argumentPatterns",
          "environmentPatterns",
          "fixedEnvironment",
        ],
        `shell script policy ${id}`,
      );
      const argumentPatterns = raw.argumentPatterns || [];
      if (!Array.isArray(argumentPatterns) || argumentPatterns.length > 32)
        throw new Error(
          `shell script policy ${id}.argumentPatterns must be an array with at most 32 entries`,
        );
      const environmentPatterns = raw.environmentPatterns || {};
      const fixedEnvironment = raw.fixedEnvironment || {};
      assertObject(
        environmentPatterns,
        `shell script policy ${id}.environmentPatterns`,
      );
      assertObject(
        fixedEnvironment,
        `shell script policy ${id}.fixedEnvironment`,
      );
      return [
        id,
        {
          path: boundedString(raw.path, `shell script policy ${id}.path`, {
            required: true,
            max: 2_000,
          }),
          workingDirectory: boundedString(
            raw.workingDirectory || ".",
            `shell script policy ${id}.workingDirectory`,
            { required: true, max: 2_000 },
          ),
          argumentPatterns: argumentPatterns.map((pattern, index) =>
            compilePattern(
              boundedString(pattern, `argumentPatterns[${index}]`, {
                required: true,
                max: 500,
              }),
              `argumentPatterns[${index}]`,
            ),
          ),
          environmentPatterns: Object.fromEntries(
            Object.entries(environmentPatterns).map(([name, pattern]) => {
              if (!ENVIRONMENT_NAME.test(name))
                throw new Error(
                  `shell script policy ${id} contains an invalid environment name`,
                );
              return [
                name,
                compilePattern(
                  boundedString(pattern, `environmentPatterns.${name}`, {
                    required: true,
                    max: 500,
                  }),
                  `environmentPatterns.${name}`,
                ),
              ];
            }),
          ),
          fixedEnvironment: Object.fromEntries(
            Object.entries(fixedEnvironment).map(([name, value]) => {
              if (!ENVIRONMENT_NAME.test(name))
                throw new Error(
                  `shell script policy ${id} contains an invalid fixed environment name`,
                );
              return [
                name,
                boundedString(value, `fixedEnvironment.${name}`, {
                  max: 4_000,
                }),
              ];
            }),
          ),
        },
      ];
    }),
  );
}

function validateConfiguration(configuration) {
  assertObject(configuration, "configuration");
  assertAllowedKeys(configuration, [
    "scriptId",
    "arguments",
    "environment",
    "failureStatus",
    "captureOutput",
  ]);
  const scriptId = boundedString(configuration.scriptId, "scriptId", {
    required: true,
    max: 100,
  });
  if (!SCRIPT_ID.test(scriptId))
    throw new ProviderConfigurationError(
      "INVALID_SCRIPT_ID",
      "scriptId is invalid",
    );
  const args = configuration.arguments || [];
  if (!Array.isArray(args) || args.length > 32)
    throw new ProviderConfigurationError(
      "INVALID_SCRIPT_ARGUMENTS",
      "arguments must contain at most 32 strings",
    );
  const environment = configuration.environment || {};
  assertObject(environment, "environment");
  if (Object.keys(environment).length > 32)
    throw new ProviderConfigurationError(
      "INVALID_SCRIPT_ENVIRONMENT",
      "environment has too many entries",
    );
  const failureStatus = configuration.failureStatus || "unavailable";
  if (!["unknown", "degraded", "unavailable"].includes(failureStatus)) {
    throw new ProviderConfigurationError(
      "INVALID_SHELL_FAILURE_STATUS",
      "failureStatus must be unknown, degraded or unavailable",
    );
  }
  const captureOutput = configuration.captureOutput || "none";
  if (!["none", "stdout", "stderr", "both"].includes(captureOutput)) {
    throw new ProviderConfigurationError(
      "INVALID_SHELL_CAPTURE_OUTPUT",
      "captureOutput must be none, stdout, stderr or both",
    );
  }
  return {
    scriptId,
    arguments: args.map((entry, index) =>
      boundedString(entry, `arguments[${index}]`, { max: 2_000 }),
    ),
    environment: Object.fromEntries(
      Object.entries(environment).map(([name, value]) => {
        if (!ENVIRONMENT_NAME.test(name))
          throw new ProviderConfigurationError(
            "INVALID_ENVIRONMENT_NAME",
            "environment contains an invalid name",
          );
        return [
          name,
          boundedString(value, `environment.${name}`, { max: 4_000 }),
        ];
      }),
    ),
    failureStatus,
    captureOutput,
  };
}

function validateInvocation(configuration, policy) {
  if (
    configuration.arguments.length !== policy.argumentPatterns.length ||
    configuration.arguments.some(
      (value, index) => !policy.argumentPatterns[index].test(value),
    )
  ) {
    throw new ProviderConfigurationError(
      "SCRIPT_ARGUMENT_REFUSED",
      "script arguments do not match the local policy",
    );
  }
  for (const [name, value] of Object.entries(configuration.environment)) {
    if (!policy.environmentPatterns[name]?.test(value))
      throw new ProviderConfigurationError(
        "SCRIPT_ENVIRONMENT_REFUSED",
        "script environment does not match the local policy",
      );
  }
}

export function createShellProvider({
  root,
  scripts = {},
  maxEvidenceBytes = 8_000,
  baseEnvironment = { PATH: "/usr/local/bin:/usr/bin:/bin", LANG: "C.UTF-8" },
  now = () => Date.now(),
} = {}) {
  if (!root) throw new Error("A shell policy root is required");
  const policies = normalizeScriptPolicies(scripts);
  return {
    configurationSchema: SHELL_CONFIGURATION_SCHEMA,
    validateConfiguration,
    normalizeEvidence: (evidence) => evidence,
    async execute(monitor, { signal } = {}) {
      const configuration = monitor.configuration;
      const policy = policies[configuration.scriptId];
      if (!policy)
        throw new ProviderConfigurationError(
          "SCRIPT_NOT_ALLOWED",
          "scriptId is not present in the local allowlist",
        );
      validateInvocation(configuration, policy);
      const canonicalRoot = await realpath(root);
      const command = await realpath(
        resolveInside(canonicalRoot, policy.path, "script path"),
      );
      const cwd = await realpath(
        resolveInside(
          canonicalRoot,
          policy.workingDirectory,
          "working directory",
        ),
      );
      resolveInside(canonicalRoot, command, "script path");
      resolveInside(canonicalRoot, cwd, "working directory");
      const commandStat = await stat(command);
      if (!commandStat.isFile())
        throw new ProviderConfigurationError(
          "SCRIPT_NOT_REGULAR_FILE",
          "allowlisted script is not a regular file",
        );
      await access(command, fsConstants.X_OK);
      const startedAt = now();
      const redactions = sensitiveValues(policy.fixedEnvironment);
      const result = await executeShellProcess(
        command,
        configuration.arguments,
        {
          cwd,
          env: {
            ...baseEnvironment,
            ...policy.fixedEnvironment,
            ...configuration.environment,
          },
        },
        signal,
        maxEvidenceBytes +
          Math.max(0, ...redactions.map((value) => value.length)),
      );
      const healthy = result.code === 0;
      const captureStdout = ["stdout", "both"].includes(
        configuration.captureOutput,
      );
      const captureStderr = ["stderr", "both"].includes(
        configuration.captureOutput,
      );
      const capturedMetadata = {
        ...(captureStdout
          ? {
              shell_stdout: truncateText(
                sanitizeEvidenceText(result.stdout, redactions),
                maxEvidenceBytes,
              ),
            }
          : {}),
        ...(captureStderr
          ? {
              shell_stderr: truncateText(
                sanitizeEvidenceText(result.stderr, redactions),
                maxEvidenceBytes,
              ),
            }
          : {}),
      };
      return {
        status: healthy ? "healthy" : configuration.failureStatus,
        message: healthy
          ? "Shell target completed successfully"
          : "Shell target returned a non-zero exit status",
        metadata: {
          outcome_kind: healthy ? "target_healthy" : "target_unhealthy",
          exit_code: result.code,
          termination_signal: result.signal || "",
          duration_ms: Math.max(0, now() - startedAt),
          stdout_bytes: result.stdoutBytes,
          stderr_bytes: result.stderrBytes,
          evidence_truncated:
            (captureStdout && result.stdoutBytes > maxEvidenceBytes) ||
            (captureStderr && result.stderrBytes > maxEvidenceBytes),
          ...capturedMetadata,
        },
      };
    },
  };
}
