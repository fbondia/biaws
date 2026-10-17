import path from "node:path";
import { randomBytes } from "node:crypto";
import { CliError } from "../core/errors.js";
import { parseEnv } from "../core/context.js";
import { atomicWrite } from "./release.js";

export function mcpPublicConfiguration(publicUrl) {
  let url;
  try {
    url = new URL(publicUrl);
  } catch {
    throw new CliError("Informe uma origem pública HTTPS válida.", { code: "INVALID_MCP_PUBLIC_URL" });
  }
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
  ) {
    throw new CliError("MCP exige HTTPS público; HTTP é permitido somente em loopback para desenvolvimento.", {
      code: "INVALID_MCP_PUBLIC_URL",
    });
  }
  return {
    publicUrl: url.origin,
    resource: url.origin + "/mcp",
    issuer: url.origin + "/api/auth",
    scheme: url.protocol.slice(0, -1),
  };
}
export function mcpInstanceSummary(instance) {
  return {
    configured: instance.env.BIAWS_MCP_CONFIGURED === "true",
    enabled: instance.env.BIAWS_MCP_HTTP_ENABLED === "true",
    resource: instance.env.BIAWS_MCP_PUBLIC_URL || "",
    issuer: instance.env.BIAWS_PUBLIC_URL ? instance.env.BIAWS_PUBLIC_URL + "/api/auth" : "",
  };
}
function replaceEnvironment(contents, values) {
  let next = contents;
  for (const [key, value] of Object.entries(values)) {
    const line = key + "=" + value;
    const pattern = new RegExp("^" + key + "=.*$", "gmu");
    next = pattern.test(next) ? next.replace(pattern, () => line) : next.replace(/\s*$/u, "") + "\n" + line + "\n";
  }
  return next;
}
export async function configureMcpInstance(
  envFile,
  enabled,
  filesystem,
  { uid = process.getuid?.() ?? 1000, gid = process.getgid?.() ?? 1000 } = {},
) {
  const contents = await filesystem.readFile(envFile, "utf8");
  const env = parseEnv(contents);
  const configured = enabled || env.BIAWS_MCP_CONFIGURED === "true";
  const values = { BIAWS_MCP_HTTP_ENABLED: String(enabled) };
  if (configured) {
    const config = mcpPublicConfiguration(env.BIAWS_PUBLIC_URL);
    const secretPath = env.BIAWS_MCP_SERVICE_SECRET_PATH || path.join(path.dirname(envFile), ".mcp-service-secret");
    if (/[\r\n$#"'\\]/u.test(secretPath))
      throw new CliError("Caminho de segredo incompatível com Compose.", { code: "INVALID_MCP_SECRET_PATH" });
    let secret;
    try {
      secret = await filesystem.readFile(secretPath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      secret = randomBytes(32).toString("hex");
      await filesystem.writeFile(secretPath, secret, { mode: 0o600, flag: "wx" });
    }
    if (secret.trim().length < 32 || secret.length > 4096)
      throw new CliError("Segredo MCP inválido; use um arquivo dedicado de 32 a 4096 caracteres.", {
        code: "INVALID_MCP_SERVICE_SECRET",
      });
    await filesystem.chmod(secretPath, 0o600);
    Object.assign(values, {
      BIAWS_MCP_CONFIGURED: "true",
      BIAWS_MCP_PUBLIC_URL: config.resource,
      BIAWS_PUBLIC_SCHEME: config.scheme,
      BIAWS_MCP_SERVICE_SECRET_PATH: secretPath,
      BIAWS_MCP_UID: env.BIAWS_MCP_UID || uid,
      BIAWS_MCP_GID: env.BIAWS_MCP_GID || gid,
    });
  }
  await atomicWrite(envFile, replaceEnvironment(contents, values), filesystem);
  return { configured, enabled, ...(configured ? mcpPublicConfiguration(env.BIAWS_PUBLIC_URL) : {}) };
}
export async function diagnoseMcp(publicUrl, { fetchImpl = fetch } = {}) {
  const config = mcpPublicConfiguration(publicUrl);
  const checks = [];
  const get = async (name, url) => {
    try {
      const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const result = await response.json();
      checks.push({ name, ok: true });
      return result;
    } catch {
      checks.push({ name, ok: false, message: "Não foi possível ler " + url + ". Verifique TLS, proxy e serviço." });
      return null;
    }
  };
  const protectedResource = await get(
    "resource-discovery",
    config.publicUrl + "/.well-known/oauth-protected-resource/mcp",
  );
  const authorization = await get(
    "authorization-discovery",
    config.publicUrl + "/.well-known/oauth-authorization-server/api/auth",
  );
  if (protectedResource)
    checks.push({
      name: "resource-binding",
      ok:
        protectedResource.resource === config.resource &&
        protectedResource.authorization_servers?.includes(config.issuer),
    });
  if (authorization)
    checks.push({
      name: "issuer-and-pkce",
      ok: authorization.issuer === config.issuer && authorization.code_challenge_methods_supported?.includes("S256"),
    });
  await get("api-health", config.publicUrl + "/api/health");
  try {
    const response = await fetchImpl(config.resource, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(5000),
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "biaws-doctor", version: "1" } },
      }),
    });
    checks.push({
      name: "mcp-oauth-challenge",
      ok:
        response.status === 401 &&
        (response.headers.get("www-authenticate") || "").includes("oauth-protected-resource"),
    });
    await response.body?.cancel();
  } catch {
    checks.push({ name: "mcp-oauth-challenge", ok: false });
  }
  return {
    ...config,
    ok: checks.every((check) => check.ok),
    checks,
    observation: "Verificações realizadas a partir desta máquina. Acessibilidade pelo ChatGPT ainda não comprovada.",
  };
}
export function chatgptConnectionInstructions(publicUrl) {
  const config = mcpPublicConfiguration(publicUrl);
  return {
    ...config,
    authentication: "OAuth",
    steps: [
      "No ChatGPT, crie uma conexão MCP personalizada com a URL do recurso e autenticação OAuth.",
      "Autentique no navegador com sua conta BIAWS, escolha o workspace e consinta os acessos.",
      "Para outro workspace, crie outra autorização. Revogue conexões em Minha conta no BIAWS.",
    ],
    catalog: "O plugin distribuível não implica elegibilidade ou publicação no catálogo.",
  };
}
