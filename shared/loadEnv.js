import { existsSync, readFileSync } from "fs";
import path from "path";

function parseEnvFile(contents) {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key) continue;

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    value = value.replace(/\\n/g, "\n");
    parsed[key] = value;
  }

  return parsed;
}

function applyEnvFile(envPath, override) {
  if (typeof process.loadEnvFile === "function" && !override) {
    process.loadEnvFile(envPath);
    return;
  }

  const parsed = parseEnvFile(readFileSync(envPath, "utf8"));

  for (const [key, value] of Object.entries(parsed)) {
    if (!override && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

/**
 * Carrega variáveis de ambiente com fallback: raiz → aplicação → instância.
 *
 * Precedência: variáveis já definidas no processo não são sobrescritas (override: false),
 * exceto quando o env local da tool tem override: true.
 *
 * @param {string} toolDir   - Caminho absoluto da raiz da tool (onde fica package.json)
 * @param {object} [opts]
 * @param {string} [opts.envName]  - Nome do arquivo .env (default: ".env")
 * @param {string} [opts.envPath]  - Arquivo explícito da instância
 * @param {boolean} [opts.quiet]   - Suprime logs de carregamento (default: true)
 * @param {string[]} [opts.preserve] - Variáveis já definidas que não podem ser sobrescritas
 * @returns {{ loaded: string[] }} - Lista de caminhos carregados
 */
export function loadEnv(toolDir, opts = {}) {
  const { envName = ".env", quiet = true } = opts;
  const preserved = new Map(
    (opts.preserve || [])
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  const issuesRoot = path.resolve(toolDir, "..");
  const explicitEnvPath = String(
    opts.envPath || process.env.BIAWS_ENV_FILE || "",
  ).trim();
  const loaded = [];

  const candidates = [
    { envPath: path.resolve(issuesRoot, envName), override: false },
    { envPath: path.resolve(toolDir, envName), override: true },
    ...(explicitEnvPath
      ? [{ envPath: path.resolve(explicitEnvPath), override: true }]
      : []),
  ];

  for (const { envPath, override } of candidates) {
    if (loaded.includes(envPath)) continue;
    if (!existsSync(envPath)) continue;

    applyEnvFile(envPath, override);
    loaded.push(envPath);
  }

  for (const [key, value] of preserved) process.env[key] = value;

  if (!quiet && loaded.length > 0) {
    console.log("Env carregado:", loaded);
  }

  return { loaded };
}
