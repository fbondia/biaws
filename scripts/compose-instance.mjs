import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { parseEnv } from "../biaws-cli/src/core/context.js";
const [root, envFile, project, ...operation] = process.argv.slice(2);
if (!root || !envFile || !project || !operation.length)
  throw new Error("compose-instance requires root, env, project and operation");
const env = parseEnv(await readFile(envFile, "utf8"));
const args = [
  "compose",
  "--project-directory",
  root,
  "--file",
  path.join(root, "compose.yaml"),
  "--env-file",
  envFile,
  "--project-name",
  project,
];
if (env.BIAWS_MCP_CONFIGURED === "true") {
  args.push("--file", path.join(root, "compose.mcp.yaml"));
  // Lifecycle scripts must also see stopped/disabled MCP containers.
  if (env.BIAWS_MCP_HTTP_ENABLED === "true" || operation[0] === "stop") args.push("--profile", "mcp-http");
}
const child = spawn("docker", [...args, ...operation], { stdio: "inherit" });
child.on("error", () => {
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
