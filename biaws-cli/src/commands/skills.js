import { readdir } from "node:fs/promises";
import path from "node:path";

import { buildSkillPayload } from "../skillPackage.js";
import {
  checksumInstalledSkill,
  installSkillPackage,
  readLock,
} from "../localSkills.js";

function targetFrom(options) {
  return path.resolve(options.target || ".agents/skills");
}

function printJson(value, options) {
  if (!options.json) return false;
  console.log(JSON.stringify(value, null, 2));
  return true;
}

async function install(api, skillId, version, options) {
  const metadata = await api.get(skillId, version);
  if (!metadata.skill) throw new Error(`Skill não encontrada: ${skillId}`);
  const skillPackage = await api.download(skillId, metadata.skill.version);
  return installSkillPackage(skillPackage, targetFrom(options), {
    force: options.force,
  });
}

async function findSkillDirectories(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const entries = await readdir(root, { withFileTypes: true });
  const directories = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const directory = path.join(root, entry.name);
    try {
      const children = await readdir(directory);
      if (children.includes("SKILL.md")) directories.push(directory);
    } catch (error) {
      if (error.code !== "ENOENT" && error.code !== "EACCES") throw error;
    }
  }
  return directories;
}

async function listSkills(api, _positional, options) {
  const result = await api.list();
  if (printJson(result, options)) return;
  if (!result.items.length) {
    console.log("Nenhuma skill publicada.");
    return;
  }
  for (const item of result.items) {
    console.log(`${item.skillId}@${item.latestVersion}  ${item.description}`);
  }
}

async function publishSkill(api, _positional, options) {
  if (!options.dir) throw new Error("Informe --dir <diretório-da-skill>");
  if (!options.version) throw new Error("Informe --version <semver>");
  const payload = await buildSkillPayload(options.dir, options);
  const result = await api.publish(payload);
  if (!printJson(result, options)) {
    console.log(
      `Publicada ${result.skill.skillId}@${result.skill.version} (${result.skill.packageSha256})`,
    );
  }
}

async function publishAllSkills(api, _positional, options) {
  const rootDirectory = options.dir || ".agents/skills";
  const version = options["initial-version"] || options.version;
  if (!version) throw new Error("Informe --initial-version <semver>");
  const [directories, catalog] = await Promise.all([
    findSkillDirectories(rootDirectory),
    api.list({ includeDeprecated: true }),
  ]);
  const publishedVersions = new Map(
    catalog.items.map((item) => [
      item.skillId,
      new Set((item.versions || []).map((candidate) => candidate.version)),
    ]),
  );
  const result = { published: [], skipped: [], failed: [] };

  for (const directory of directories) {
    try {
      const payload = await buildSkillPayload(directory, {
        ...options,
        version,
      });
      if (publishedVersions.get(payload.skillId)?.has(version)) {
        result.skipped.push({
          skillId: payload.skillId,
          version,
          reason: "version-already-exists",
        });
        continue;
      }
      const response = await api.publish(payload);
      result.published.push({
        skillId: response.skill.skillId,
        version: response.skill.version,
        packageSha256: response.skill.packageSha256,
      });
    } catch (error) {
      result.failed.push({
        directory,
        message: error.message,
      });
    }
  }

  if (printJson(result, options)) {
    if (result.failed.length) process.exitCode = 1;
    return;
  }
  for (const item of result.published)
    console.log(`Publicada ${item.skillId}@${item.version}`);
  for (const item of result.skipped)
    console.log(
      `Ignorada ${item.skillId}@${item.version}: versão já existente`,
    );
  for (const item of result.failed)
    console.error(`Falha em ${item.directory}: ${item.message}`);
  console.log(
    `Resumo: ${result.published.length} publicada(s), ${result.skipped.length} ignorada(s), ${result.failed.length} falha(s).`,
  );
  if (result.failed.length) process.exitCode = 1;
}

async function installSkill(api, positional, options) {
  const skillId = positional[0];
  if (!skillId)
    throw new Error("Informe a skill: biaws skills install <skill-id>");
  const result = await install(api, skillId, options.version, options);
  if (!printJson(result, options)) {
    console.log(
      `Instalada ${skillId}@${result.skill.version} em ${result.directory}`,
    );
  }
}

async function installAllSkills(api, _positional, options) {
  const [catalog, lock] = await Promise.all([
    api.list(),
    readLock(targetFrom(options)),
  ]);
  const results = { installed: [], skipped: [], failed: [] };
  for (const item of catalog.items) {
    if (lock.skills[item.skillId] && !options.force) {
      results.skipped.push({
        skillId: item.skillId,
        version: lock.skills[item.skillId].version,
        reason: "already-installed",
      });
      continue;
    }
    try {
      const result = await install(api, item.skillId, item.latestVersion, {
        ...options,
        force: Boolean(lock.skills[item.skillId]),
      });
      results.installed.push({
        skillId: item.skillId,
        version: result.skill.version,
        directory: result.directory,
      });
    } catch (error) {
      results.failed.push({ skillId: item.skillId, message: error.message });
    }
  }
  if (printJson(results, options)) {
    if (results.failed.length) process.exitCode = 1;
    return results;
  }
  if (!options.quiet) {
    for (const item of results.installed)
      console.log(
        `Instalada ${item.skillId}@${item.version} em ${item.directory}`,
      );
    for (const item of results.skipped)
      console.log(`Preservada ${item.skillId}@${item.version}`);
    for (const item of results.failed)
      console.error(`Falha em ${item.skillId}: ${item.message}`);
  }
  if (results.failed.length) process.exitCode = 1;
  return results;
}

function skillStatus(local, installedChecksum, latestVersion) {
  if (installedChecksum === null) return "missing";
  if (installedChecksum !== local.packageSha256) return "modified";
  if (!latestVersion) return "not-in-catalog";
  return latestVersion === local.version ? "current" : "update-available";
}

async function getInstalledSkillsStatus(api, options) {
  const lock = await readLock(targetFrom(options));
  const catalog = await api.list();
  const latestById = new Map(
    catalog.items.map((item) => [item.skillId, item.latestVersion]),
  );
  const items = [];
  for (const [skillId, local] of Object.entries(lock.skills)) {
    const installedChecksum = await checksumInstalledSkill(
      path.join(targetFrom(options), skillId),
    );
    const latestVersion = latestById.get(skillId) || null;
    items.push({
      skillId,
      installedVersion: local.version,
      latestVersion,
      status: skillStatus(local, installedChecksum, latestVersion),
    });
  }
  return items;
}

async function showSkillsStatus(api, _positional, options) {
  const items = await getInstalledSkillsStatus(api, options);
  if (printJson({ items }, options)) return;
  if (!items.length) {
    console.log("Nenhuma skill instalada pelo Bondia Workspaces CLI.");
    return;
  }
  for (const item of items) {
    const latest = item.latestVersion ? `; catálogo ${item.latestVersion}` : "";
    console.log(
      `${item.skillId}@${item.installedVersion}: ${item.status}${latest}`,
    );
  }
}

async function updateSkills(api, positional, options) {
  const requestedSkillId = positional[0];
  const lock = await readLock(targetFrom(options));
  const catalog = await api.list();
  if (requestedSkillId && !lock.skills[requestedSkillId]) {
    throw new Error(
      `Skill não instalada pelo Bondia Workspaces CLI: ${requestedSkillId}`,
    );
  }
  const candidates = catalog.items.filter(
    (item) =>
      (!requestedSkillId || item.skillId === requestedSkillId) &&
      lock.skills[item.skillId] &&
      lock.skills[item.skillId].version !== item.latestVersion,
  );
  const results = [];
  for (const item of candidates) {
    results.push(
      await install(api, item.skillId, item.latestVersion, {
        ...options,
        force: true,
      }),
    );
  }
  if (printJson({ items: results }, options)) return;
  if (!results.length) console.log("Todas as skills estão atualizadas.");
  for (const result of results) {
    console.log(
      `Atualizada ${path.basename(result.directory)} para ${result.skill.version}`,
    );
  }
}

const ACTION_HANDLERS = {
  install: installSkill,
  "install-all": installAllSkills,
  list: listSkills,
  publish: publishSkill,
  "publish-all": publishAllSkills,
  status: showSkillsStatus,
  update: updateSkills,
};

export async function runSkillsCommand(api, action, positional, options) {
  const handler = ACTION_HANDLERS[action];
  if (!handler)
    throw new Error(`Ação de skills desconhecida: ${action || "(ausente)"}`);
  return handler(api, positional, options);
}
