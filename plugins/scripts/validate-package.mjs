import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { fileURLToPath } from "node:url";
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const pluginSchema = JSON.parse(await readFile(new URL("../schemas/plugin.schema.json", import.meta.url), "utf8"));
const mcpSchema = JSON.parse(await readFile(new URL("../schemas/mcp.schema.json", import.meta.url), "utf8"));
// The canonical MCP 1.0.0 schema currently omits server extensions although
// OpenAI documents auth there. Validate the core projection unchanged, and
// independently validate the single documented OpenAI extension below.
const openaiAuthSchema = {
  type: "object",
  additionalProperties: false,
  required: ["com.openai"],
  properties: {
    "com.openai": {
      type: "object",
      additionalProperties: false,
      required: ["auth"],
      properties: {
        auth: {
          type: "object",
          additionalProperties: false,
          required: ["type", "client", "baseScopes", "oidcEnabled"],
          properties: {
            type: { const: "oauth" },
            client: {
              type: "object",
              required: ["mode"],
              additionalProperties: false,
              properties: { mode: { const: "cimd" } },
            },
            baseScopes: {
              type: "array",
              minItems: 1,
              uniqueItems: true,
              items: { enum: ["mcp:read", "mcp:write", "offline_access"] },
            },
            oidcEnabled: { const: false },
          },
        },
      },
    },
  },
};
const validatePlugin = ajv.compile(pluginSchema),
  validateMcp = ajv.compile(mcpSchema),
  validateAuth = ajv.compile(openaiAuthSchema);
export function validateManifests(plugin, mcp, paths, { allowLoopback = false } = {}) {
  if (!validatePlugin(plugin)) throw new Error("Invalid plugin schema: " + ajv.errorsText(validatePlugin.errors));
  if (plugin.name !== "biaws" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(plugin.version))
    throw new Error("Invalid plugin identity/version");
  const openai = plugin.extensions?.["com.openai"];
  if (!openai?.interface || openai.hooks || openai.apps) throw new Error("Only portable remote metadata is allowed");
  for (const ref of [openai.onboardingSkill, openai.interface.composerIcon, openai.interface.logo]) {
    if (
      typeof ref !== "string" ||
      !ref.startsWith("./") ||
      ref.split("/").some((part) => part === ".." || (part === "." && !ref.startsWith("./"))) ||
      !paths.has(ref.slice(2))
    )
      throw new Error("Invalid or missing package reference");
  }
  if (Object.keys(mcp.mcpServers || {}).join() !== "biaws") throw new Error("Expected one BIAWS server");
  const server = mcp.mcpServers.biaws;
  if (
    server.type !== "streamable-http" ||
    Object.keys(server).some((key) => !["type", "url", "extensions"].includes(key))
  )
    throw new Error("Only Streamable HTTP with OAuth discovery and no static headers is allowed");
  if (!validateAuth(server.extensions)) throw new Error("Invalid documented OpenAI OAuth extension");
  const core = structuredClone(mcp);
  delete core.mcpServers.biaws.extensions;
  if (!validateMcp(core)) throw new Error("Invalid MCP core schema: " + ajv.errorsText(validateMcp.errors));
  const endpoint = new URL(server.url);
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== "/mcp" ||
    (endpoint.protocol !== "https:" &&
      !(
        allowLoopback &&
        endpoint.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname)
      )) ||
    endpoint.hostname.endsWith(".invalid")
  )
    throw new Error("Explicit valid HTTPS MCP endpoint required");
  if (!server.extensions["com.openai"].auth.baseScopes.includes("mcp:read"))
    throw new Error("mcp:read scope is required");
  return {
    endpoint: endpoint.toString(),
    schemaProfile: "Agent Plugins 1.0.0 core + documented OpenAI OAuth extension",
  };
}
export function rejectSecretContent(name, bytes) {
  if (!/\.(json|md)$/u.test(name)) return;
  const value = Buffer.from(bytes).toString("utf8");
  if (
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|["'](?:clientSecret|access_token|refresh_token|Authorization)["']\s*:|biaws_[A-Za-z0-9_-]{24,}|plugin_asdk_app[_-]|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/u.test(
      value,
    )
  )
    throw new Error("Credential-like content rejected in " + name);
}

export function validateIcon(bytes) {
  const png = Buffer.from(bytes || []);
  if (
    png.length < 33 ||
    png.length > 256 * 1024 ||
    png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    png.readUInt32BE(8) !== 13 ||
    png.subarray(12, 16).toString() !== "IHDR" ||
    png.readUInt32BE(16) !== png.readUInt32BE(20) ||
    png.readUInt32BE(16) < 48 ||
    png.readUInt32BE(16) > 4096
  )
    throw new Error("Expected a square PNG icon of 48–4096 pixels within the package size limit");
}
