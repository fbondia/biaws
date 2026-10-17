import { readdir, readFile, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function validateSkills(root, toolNames) {
  const folders = await readdir(root, { withFileTypes: true });
  const names = new Set(folders.filter((f) => f.isDirectory()).map((f) => f.name));
  if (names.size !== 6 || !names.has("setup")) throw new Error("Expected six portable skills including setup");
  const report = [];
  for (const folder of folders) {
    if (!folder.isDirectory() || folder.isSymbolicLink()) throw new Error("Unexpected skill entry: " + folder.name);
    const dir = path.join(root, folder.name);
    const entries = await readdir(dir);
    if (entries.join() !== "SKILL.md") throw new Error("Unreviewed portable skill resources: " + folder.name);
    const file = path.join(dir, "SKILL.md");
    if (!(await lstat(file)).isFile()) throw new Error("Skill must be a regular file");
    const content = await readFile(file, "utf8");
    const match = content.match(/^---\nname: ([a-z0-9-]+)\ndescription: (.+)\n---\n/u);
    if (!match || match[1] !== folder.name || match[2].length > 1024)
      throw new Error("Invalid skill metadata: " + folder.name);
    if (/\/(?:Users|home)\/|[A-Z]:\\|\$HOME|CODEX_HOME|\x60\x60\x60(?:bash|sh|powershell)/u.test(content))
      throw new Error("Local runtime dependency: " + folder.name);
    const tools = [...content.matchAll(/\x60([a-z]+_[a-z0-9_]+)\x60/gu)].map((m) => m[1]);
    for (const tool of tools) if (!toolNames.has(tool)) throw new Error("Unavailable remote tool: " + tool);
    for (const skill of content.matchAll(/\b(biaws-[a-z-]+)\b/gu))
      if (!names.has(skill[1])) throw new Error("Missing bundled skill: " + skill[1]);
    report.push({ name: folder.name, tools: [...new Set(tools)].sort() });
  }
  return report.sort((a, b) => a.name.localeCompare(b.name));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { listTools } = await import("../../biaws-mcp/dist/src/mcp/tools/tools.js");
  const tools = new Set(
    listTools()
      .filter((t) => !t.name.endsWith("_eml_file"))
      .map((t) => t.name),
  );
  const root = process.argv[2] || fileURLToPath(new URL("../biaws/skills", import.meta.url));
  console.log(JSON.stringify(await validateSkills(root, tools), null, 2));
}
