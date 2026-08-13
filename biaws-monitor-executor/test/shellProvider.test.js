import assert from "node:assert/strict";
import { chmod, mkdtemp, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createShellProvider } from "../src/shellProvider.js";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-shell-provider-"));
  t.after(() =>
    import("node:fs/promises").then(({ rm }) =>
      rm(root, { recursive: true, force: true }),
    ),
  );
  return root;
}

async function executable(filename, content) {
  await writeFile(filename, content);
  await chmod(filename, 0o700);
}

test("shell provider executes only an allowlisted script without a shell", async (t) => {
  const root = await fixture(t);
  await executable(
    path.join(root, "check.sh"),
    '#!/bin/sh\nprintf \'%s:%s:%s\' "$1" "$TARGET" "$API_TOKEN"\n',
  );
  const provider = createShellProvider({
    root,
    maxEvidenceBytes: 100,
    scripts: {
      health: {
        path: "check.sh",
        argumentPatterns: ["[a-z-]+"],
        environmentPatterns: { TARGET: "[a-z.]+" },
        fixedEnvironment: { API_TOKEN: "private-value" },
      },
    },
  });
  const configuration = provider.validateConfiguration({
    scriptId: "health",
    arguments: ["probe"],
    environment: { TARGET: "service.local" },
  });
  const result = await provider.execute({ configuration }, {});
  assert.equal(result.status, "healthy");
  assert.equal(result.payload, undefined);
  assert.equal(result.metadata.shell_stdout, undefined);
  assert.doesNotMatch(JSON.stringify(result), /private-value/u);
});

test("shell provider maps non-zero exits and captures only configured streams", async (t) => {
  const root = await fixture(t);
  await executable(
    path.join(root, "failing.sh"),
    "#!/bin/sh\nprintf 'token=private-value'\nprintf 'failure detail' >&2\nexit 7\n",
  );
  const provider = createShellProvider({
    root,
    maxEvidenceBytes: 100,
    scripts: {
      failing: {
        path: "failing.sh",
        argumentPatterns: [],
        fixedEnvironment: { API_TOKEN: "private-value" },
      },
    },
  });
  const configuration = provider.validateConfiguration({
    scriptId: "failing",
    failureStatus: "degraded",
    captureOutput: "both",
  });
  const result = await provider.execute({ configuration }, {});

  assert.equal(result.status, "degraded");
  assert.equal(result.metadata.exit_code, 7);
  assert.equal(result.metadata.shell_stdout, "token=[REDACTED]");
  assert.equal(result.metadata.shell_stderr, "failure detail");
  assert.equal(result.payload, undefined);
  assert.doesNotMatch(JSON.stringify(result), /private-value/u);
});

test("shell provider rejects unsupported failure and capture modes", async (t) => {
  const root = await fixture(t);
  const provider = createShellProvider({ root, scripts: {} });
  assert.throws(
    () =>
      provider.validateConfiguration({
        scriptId: "health",
        failureStatus: "healthy",
      }),
    { code: "INVALID_SHELL_FAILURE_STATUS" },
  );
  assert.throws(
    () =>
      provider.validateConfiguration({
        scriptId: "health",
        captureOutput: "all",
      }),
    { code: "INVALID_SHELL_CAPTURE_OUTPUT" },
  );
});

test("shell provider truncates only captured output", async (t) => {
  const root = await fixture(t);
  await executable(
    path.join(root, "verbose.sh"),
    "#!/bin/sh\nprintf '123456789'\nprintf 'abcdefghi' >&2\n",
  );
  const provider = createShellProvider({
    root,
    maxEvidenceBytes: 5,
    scripts: { verbose: { path: "verbose.sh", argumentPatterns: [] } },
  });
  const configuration = provider.validateConfiguration({
    scriptId: "verbose",
    captureOutput: "stdout",
  });
  const result = await provider.execute({ configuration }, {});

  assert.equal(result.metadata.shell_stdout, "12345");
  assert.equal(result.metadata.shell_stderr, undefined);
  assert.equal(result.metadata.evidence_truncated, true);
  assert.equal(result.metadata.stdout_bytes, 9);
  assert.equal(result.metadata.stderr_bytes, 9);
});

test("shell provider refuses arbitrary commands, arguments and symlink escapes", async (t) => {
  const root = await fixture(t);
  await executable(path.join(root, "check.sh"), "#!/bin/sh\nexit 0\n");
  await symlink("/bin/sh", path.join(root, "escaped"));
  const provider = createShellProvider({
    root,
    scripts: {
      health: { path: "check.sh", argumentPatterns: ["--safe"] },
      escaped: { path: "escaped", argumentPatterns: [] },
    },
  });
  assert.throws(
    () =>
      provider.validateConfiguration({
        scriptId: "health",
        command: "rm -rf /",
      }),
    { code: "UNKNOWN_PROVIDER_CONFIGURATION_FIELD" },
  );
  const unsafeArgument = provider.validateConfiguration({
    scriptId: "health",
    arguments: ["; touch /tmp/not-allowed"],
  });
  await assert.rejects(
    provider.execute({ configuration: unsafeArgument }, {}),
    { code: "SCRIPT_ARGUMENT_REFUSED" },
  );
  const escaped = provider.validateConfiguration({ scriptId: "escaped" });
  await assert.rejects(provider.execute({ configuration: escaped }, {}), {
    code: "PATH_OUTSIDE_POLICY_ROOT",
  });
});

test("shell provider abort terminates a timed out process", async (t) => {
  const root = await fixture(t);
  await executable(path.join(root, "slow.sh"), "#!/bin/sh\nsleep 30\n");
  const provider = createShellProvider({
    root,
    scripts: { slow: { path: "slow.sh", argumentPatterns: [] } },
  });
  const configuration = provider.validateConfiguration({ scriptId: "slow" });
  const controller = new AbortController();
  const startedAt = Date.now();
  const execution = provider.execute(
    { configuration },
    { signal: controller.signal },
  );
  setTimeout(
    () =>
      controller.abort(
        Object.assign(new Error("timeout"), { code: "PROVIDER_TIMEOUT" }),
      ),
    50,
  );
  await assert.rejects(execution, { code: "PROVIDER_TIMEOUT" });
  assert.ok(Date.now() - startedAt < 2_000);
});
