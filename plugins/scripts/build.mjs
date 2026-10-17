import { readdir, readFile, lstat, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { zipSync, unzipSync } from "fflate";
import { validateManifests, rejectSecretContent } from "./validate-package.mjs";
import { validateSkills } from "./validate-skills.mjs";
const source = fileURLToPath(new URL("../biaws", import.meta.url));
async function files(root, prefix = "") {
  const output = {};
  for (const name of (await readdir(root)).sort()) {
    const relative = prefix + name,
      full = path.join(root, name),
      stat = await lstat(full);
    if (stat.isSymbolicLink()) throw new Error("Symlinks are not packaged");
    if (stat.isDirectory()) Object.assign(output, await files(full, relative + "/"));
    else if (stat.isFile()) output[relative] = new Uint8Array(await readFile(full));
    else throw new Error("Unexpected package entry");
  }
  return output;
}
export async function buildPlugin({ url, outputDirectory, sourceDirectory = source, allowLoopback = false }) {
  if (!url) throw new Error("--url must identify the instance MCP endpoint");
  const entries = await files(sourceDirectory);
  const allowed = (p) =>
    ["plugin.json", "mcp.json", "LICENSE", "assets/icon.png"].includes(p) || /^skills\/[a-z0-9-]+\/SKILL\.md$/u.test(p);
  for (const name of Object.keys(entries)) if (!allowed(name)) throw new Error("Unexpected payload file: " + name);
  const plugin = JSON.parse(Buffer.from(entries["plugin.json"]).toString()),
    mcp = JSON.parse(Buffer.from(entries["mcp.json"]).toString());
  mcp.mcpServers.biaws.url = url;
  entries["mcp.json"] = Buffer.from(JSON.stringify(mcp, null, 2) + "\n");
  const profile = validateManifests(plugin, mcp, new Set(Object.keys(entries)), { allowLoopback });
  const { listTools } = await import("../../biaws-mcp/dist/src/mcp/tools/tools.js");
  await validateSkills(
    path.join(sourceDirectory, "skills"),
    new Set(
      listTools()
        .filter((t) => !t.name.endsWith("_eml_file"))
        .map((t) => t.name),
    ),
  );
  const png = Buffer.from(entries["assets/icon.png"]);
  if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" || png.readUInt32BE(16) !== png.readUInt32BE(20))
    throw new Error("Expected existing square PNG icon");
  const payload = {};
  for (const name of Object.keys(entries).sort()) {
    rejectSecretContent(name, entries[name]);
    payload[name] = [entries[name], { mtime: new Date(1980, 0, 1), level: 0, os: 3, attrs: 0o100644 << 16 }];
  }
  const zip = zipSync(payload, { level: 0 });
  const unpacked = unzipSync(zip);
  if (Object.keys(unpacked).join() !== Object.keys(payload).join()) throw new Error("Archive inventory mismatch");
  const sha256 = createHash("sha256").update(zip).digest("hex"),
    name = "biaws-plugin-" + plugin.version + ".zip";
  const out = path.resolve(outputDirectory || fileURLToPath(new URL("../dist", import.meta.url)));
  if (out === sourceDirectory || out.startsWith(sourceDirectory + path.sep))
    throw new Error("Output must be outside source package");
  await mkdir(out, { recursive: true });
  await writeFile(path.join(out, name), zip);
  await writeFile(path.join(out, name + ".sha256"), sha256 + "  " + name + "\n");
  const report = {
    name,
    version: plugin.version,
    sha256,
    ...profile,
    files: Object.keys(unpacked),
    publication: "local-instance-test-only",
  };
  await writeFile(path.join(out, "build-report.json"), JSON.stringify(report, null, 2) + "\n");
  return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const value = (flag) => args[args.indexOf(flag) + 1];
  const allowed = new Set(["--url", "--out", "--allow-loopback"]);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error("Unknown build option");
    if (args[i] !== "--allow-loopback") i++;
  }
  console.log(
    JSON.stringify(
      await buildPlugin({
        url: args.includes("--url") ? value("--url") : undefined,
        outputDirectory: args.includes("--out") ? value("--out") : undefined,
        allowLoopback: args.includes("--allow-loopback"),
      }),
      null,
      2,
    ),
  );
}
