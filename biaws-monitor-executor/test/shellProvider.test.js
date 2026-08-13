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
  assert.equal(result.payload.stdout, "probe:service.local:[REDACTED]");
  assert.doesNotMatch(JSON.stringify(result), /private-value/u);
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
