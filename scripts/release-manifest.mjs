import * as filesystem from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  readAvailableRelease,
  recordAppliedRelease,
  releaseDifferences,
  validateRelease,
} from "../biaws-cli/src/instance/release.js";

const [command = "check", root = fileURLToPath(new URL("../", import.meta.url)), envFile, snapshot] =
  process.argv.slice(2);
try {
  const release = await readAvailableRelease(root, filesystem);
  if (command === "check") {
    process.stdout.write(`Manifesto da release ${release.version} validado.\n`);
  } else if (command === "snapshot") {
    process.stdout.write(JSON.stringify(release));
  } else if (command === "version") {
    process.stdout.write(release.version);
  } else if (command === "record" && envFile && snapshot) {
    const applied = validateRelease(JSON.parse(snapshot));
    if (releaseDifferences(applied, release).length)
      throw new Error("A release mudou durante o setup; repita a operação.");
    await recordAppliedRelease({ envFile }, applied, filesystem);
  } else {
    throw new Error("Uso: release-manifest.mjs check|snapshot|version|record [root] [envFile snapshot]");
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
