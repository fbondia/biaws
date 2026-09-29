import path from "node:path";
import { randomUUID } from "node:crypto";
import { CliError } from "../core/errors.js";

const COMPONENTS = ["biaws-api", "biaws-ui", "biaws-monitor-executor"];
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;

function invalid(message) {
  throw new CliError(message, { code: "INVALID_RELEASE_MANIFEST" });
}

export function validateRelease(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid("Manifesto de release inválido.");
  if (value.schemaVersion !== 1) invalid("schemaVersion do manifesto não suportada; atualize o CLI.");
  if (typeof value.version !== "string" || !VERSION.test(value.version)) invalid("Versão da release inválida.");
  if (!Number.isSafeInteger(value.deploymentRevision) || value.deploymentRevision < 1) {
    invalid("deploymentRevision deve ser um inteiro positivo.");
  }
  if (!value.components || Object.keys(value.components).sort().join() !== [...COMPONENTS].sort().join()) {
    invalid("O manifesto deve conter as versões de biaws-api, biaws-ui e biaws-monitor-executor.");
  }
  const components = {};
  for (const component of COMPONENTS) {
    const version = value.components[component];
    if (typeof version !== "string" || !VERSION.test(version)) invalid(`Versão inválida: ${component}.`);
    components[component] = version;
  }
  return Object.freeze({
    schemaVersion: 1,
    version: value.version,
    deploymentRevision: value.deploymentRevision,
    components: Object.freeze(components),
  });
}

export async function readRelease(file, filesystem, { optional = false } = {}) {
  let contents;
  try {
    contents = await filesystem.readFile(file, "utf8");
  } catch (error) {
    if (optional && error.code === "ENOENT") return null;
    throw new CliError(`Não foi possível ler o manifesto ${file}.`, {
      code: "RELEASE_MANIFEST_READ_FAILED",
      cause: error,
    });
  }
  let value;
  try {
    value = JSON.parse(contents);
  } catch {
    invalid(`JSON inválido no manifesto ${file}.`);
  }
  return validateRelease(value);
}

export async function readAvailableRelease(root, filesystem) {
  const release = await readRelease(path.join(root, "release.json"), filesystem);
  for (const component of COMPONENTS) {
    const manifest = JSON.parse(await filesystem.readFile(path.join(root, component, "package.json"), "utf8"));
    if (manifest.version !== release.components[component]) {
      invalid(`release.json diverge de ${component}/package.json; atualize o manifesto antes de implantar.`);
    }
  }
  return release;
}

export function releaseDifferences(current, available) {
  const differences = [];
  for (const field of ["version", "deploymentRevision", ...COMPONENTS]) {
    const before = COMPONENTS.includes(field) ? current?.components[field] : current?.[field];
    const after = COMPONENTS.includes(field) ? available.components[field] : available[field];
    if (before !== after) differences.push({ field, current: before ?? null, available: after });
  }
  return differences;
}

export function appliedReleasePath(instance) {
  return path.join(path.dirname(instance.envFile), "release.json");
}

export async function atomicWrite(file, contents, filesystem) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await filesystem.writeFile(temporary, contents, { mode: 0o600, flag: "wx" });
    await filesystem.rename(temporary, file);
  } finally {
    await filesystem.rm(temporary, { force: true });
  }
}

export async function recordAppliedRelease(instance, release, filesystem) {
  const normalized = validateRelease(release);
  const contents = await filesystem.readFile(instance.envFile, "utf8");
  const line = `BIAWS_VERSION=${normalized.version}`;
  const next = /^BIAWS_VERSION=.*$/mu.test(contents)
    ? contents.replace(/^BIAWS_VERSION=.*$/gmu, line)
    : `${contents.replace(/\s*$/u, "")}\n${line}\n`;
  await atomicWrite(instance.envFile, next, filesystem);
  await atomicWrite(appliedReleasePath(instance), `${JSON.stringify(normalized, null, 2)}\n`, filesystem);
}
