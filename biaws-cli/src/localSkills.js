import crypto from "node:crypto";
import {
  lstat,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

function lockPath(targetDirectory) {
  return path.join(path.dirname(targetDirectory), "biaws-skills.lock.json");
}

async function exists(filePath) {
  try {
    await lstat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

export async function readLock(targetDirectory) {
  try {
    return JSON.parse(await readFile(lockPath(targetDirectory), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT")
      return { format: "biaws-skills-lock/v1", skills: {} };
    throw error;
  }
}

async function collectInstalledFiles(root, current = root, result = []) {
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Link simbólico inesperado: ${absolutePath}`);
    if (entry.isDirectory()) {
      await collectInstalledFiles(root, absolutePath, result);
    } else if (entry.isFile()) {
      result.push({
        path: path.relative(root, absolutePath).split(path.sep).join("/"),
        absolutePath,
      });
    }
  }
  return result;
}

export async function checksumInstalledSkill(skillDirectory) {
  if (!(await exists(skillDirectory))) return null;
  const files = await collectInstalledFiles(skillDirectory);
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    const content = await readFile(file.absolutePath);
    const fileHash = crypto.createHash("sha256").update(content).digest("hex");
    hash.update(file.path);
    hash.update("\0");
    hash.update(fileHash);
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function writeLock(targetDirectory, lock) {
  await mkdir(path.dirname(targetDirectory), { recursive: true });
  await writeFile(
    lockPath(targetDirectory),
    `${JSON.stringify(lock, null, 2)}\n`,
    "utf8",
  );
}

function safeDestination(root, relativePath) {
  const normalized = String(relativePath || "").replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Caminho inválido no pacote: ${relativePath}`);
  }
  const destination = path.resolve(root, normalized);
  if (!destination.startsWith(`${path.resolve(root)}${path.sep}`)) {
    throw new Error(`Caminho fora do diretório da skill: ${relativePath}`);
  }
  return destination;
}

export async function installSkillPackage(
  skillPackage,
  targetDirectory,
  options = {},
) {
  if (
    skillPackage?.format !== "biaws-skill-package/v1" ||
    !skillPackage.skill
  ) {
    throw new Error("Pacote de skill inválido ou incompatível");
  }
  const skill = skillPackage.skill;
  const finalDirectory = path.join(
    path.resolve(targetDirectory),
    skill.skillId,
  );
  const temporaryDirectory = `${finalDirectory}.install-${crypto.randomUUID()}`;
  await mkdir(temporaryDirectory, { recursive: true });
  try {
    for (const file of skill.files || []) {
      const destination = safeDestination(temporaryDirectory, file.path);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, Buffer.from(file.contentBase64, "base64"));
    }
    if (await exists(finalDirectory)) {
      if (!options.force) {
        throw new Error(
          `A skill já existe em ${finalDirectory}; use --force para substituí-la`,
        );
      }
      const backupDirectory = `${finalDirectory}.backup-${new Date().toISOString().replace(/[:.]/gu, "-")}`;
      await rename(finalDirectory, backupDirectory);
    }
    await mkdir(path.dirname(finalDirectory), { recursive: true });
    await rename(temporaryDirectory, finalDirectory);
  } catch (error) {
    await rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }

  const lock = await readLock(targetDirectory);
  lock.skills[skill.skillId] = {
    version: skill.version,
    packageSha256: skill.packageSha256,
    installedAt: new Date().toISOString(),
  };
  await writeLock(targetDirectory, lock);
  return { directory: finalDirectory, skill: lock.skills[skill.skillId] };
}
