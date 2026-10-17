import assert from "node:assert/strict";
import { mkdtemp, writeFile, chmod, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// All npm and Git operations are fake executables. No registry calls/writes.
const root = await mkdtemp(path.join(os.tmpdir(), "biaws-publication-guard-"));
const script = fileURLToPath(new URL("../publish-biaws-cli.sh", import.meta.url));
const calls = path.join(root, "calls");
try {
  for (const [name, source] of Object.entries({
    git: '#!/bin/sh\n[ "$FAKE_DIRTY" = 1 ] && echo " M file"\nexit 0\n',
    npm: `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_CALLS"
case "$1" in
  whoami) exit 0 ;;
  view)
    case "$2" in
      biaws@*) echo E404 >&2; exit 1 ;;
      biaws-mcp@*)
        case "$FAKE_MCP" in
          missing) echo E404 >&2; exit 1 ;;
          unavailable) echo E503 >&2; exit 1 ;;
          wrong) echo '\"0.0.1\"'; exit 0 ;;
          available) node -p 'JSON.stringify(process.argv[1].split("@")[1])' "$2"; exit 0 ;;
        esac ;;
    esac ;;
  run|pack|publish) exit 0 ;;
esac
exit 2
`,
  })) {
    await writeFile(path.join(root, name), source);
    await chmod(path.join(root, name), 0o700);
  }
  for (const scenario of ["missing", "unavailable", "wrong", "available", "dirty"]) {
    await writeFile(calls, "");
    const result = spawnSync("bash", [script, "--publish"], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: root + path.delimiter + process.env.PATH,
        TMPDIR: root,
        FAKE_CALLS: calls,
        FAKE_MCP: scenario === "dirty" ? "available" : scenario,
        FAKE_DIRTY: scenario === "dirty" ? "1" : "0",
      },
    });
    const invoked = await readFile(calls, "utf8");
    assert.equal(result.status, scenario === "available" ? 0 : 1, result.stderr);
    assert.equal(/^publish /mu.test(invoked), scenario === "available", scenario);
    assert.equal(/^run release:check$/mu.test(invoked), scenario === "available", scenario);
    console.log(`Publication guard passed with fake registry: ${scenario}`);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
