import { readFile, writeFile, mkdtemp, mkdir, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { validateManifests, rejectSecretContent } from "./validate-package.mjs";
import { validateSkills } from "./validate-skills.mjs";

export async function verifyInstall(archive, expectedSha256, { allowLoopback = false } = {}) {
  const bytes = new Uint8Array(await readFile(archive));
  if (bytes.length > 2 * 1024 * 1024) throw new Error("Plugin archive exceeds the approved payload limit");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (!/^[a-f0-9]{64}$/u.test(expectedSha256 || "") || sha256 !== expectedSha256)
    throw new Error("Archive checksum mismatch");
  let total = 0;
  const seen = new Set();
  const entries = unzipSync(bytes, {
    filter(file) {
      const allowed =
        ["plugin.json", "mcp.json", "LICENSE", "assets/icon.png"].includes(file.name) ||
        /^skills\/[a-z0-9-]+\/SKILL\.md$/u.test(file.name);
      total += file.originalSize;
      if (!allowed || seen.has(file.name) || file.originalSize > 256 * 1024 || total > 2 * 1024 * 1024)
        throw new Error("Unsafe/unexpected archive entry");
      seen.add(file.name);
      return true;
    },
  });
  if (seen.size !== 10) throw new Error("Incomplete portable payload");
  const plugin = JSON.parse(Buffer.from(entries["plugin.json"]).toString()),
    mcp = JSON.parse(Buffer.from(entries["mcp.json"]).toString());
  const profile = validateManifests(plugin, mcp, seen, { allowLoopback });
  const directory = await mkdtemp(path.join(os.tmpdir(), "biaws-plugin-install-"));
  try {
    for (const [name, content] of Object.entries(entries)) {
      rejectSecretContent(name, content);
      const output = path.join(directory, name);
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, content, { mode: 0o600 });
    }
    const { listTools } = await import("../../biaws-mcp/dist/src/mcp/tools/tools.js");
    const skills = await validateSkills(
      path.join(directory, "skills"),
      new Set(
        listTools()
          .filter((t) => !t.name.endsWith("_eml_file"))
          .map((t) => t.name),
      ),
    );
    return {
      result: "offline-package-install-passed",
      sha256,
      version: plugin.version,
      ...profile,
      files: [...seen].sort(),
      skills: skills.map((s) => s.name),
      realChatgptValidation: "pending",
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [archive] = process.argv.slice(2);
  if (!archive) throw new Error("Usage: verify-install.mjs archive.zip");
  const checksum = (await readFile(archive + ".sha256", "utf8")).trim().split(/\s+/u)[0];
  console.log(JSON.stringify(await verifyInstall(archive, checksum), null, 2));
}
