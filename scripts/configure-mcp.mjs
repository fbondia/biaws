import * as filesystem from "node:fs/promises";
import { configureMcpInstance } from "../biaws-cli/src/instance/mcp.js";
const [envFile, enabled] = process.argv.slice(2);
if (!envFile || !["true", "false"].includes(enabled)) throw new Error("Usage: configure-mcp.mjs ENV_FILE true|false");
await configureMcpInstance(envFile, enabled === "true", filesystem);
