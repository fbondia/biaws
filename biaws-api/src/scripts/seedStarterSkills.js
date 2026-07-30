#!/usr/bin/env node

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildSkillPayload } from "../../../biaws-cli/src/skillPackage.js";
import { closeMongoClient } from "../helpers/mongoClient.js";
import { ensureDefaultWorkspace } from "../repositories/catalogRepository.js";
import { publishSkill } from "../repositories/skillsRepository.js";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

async function run() {
  const skillsDirectory = path.resolve(
    process.env.BIAWS_STARTER_SKILLS_DIR ||
      path.join(ROOT_DIR, "starter-skills"),
  );
  const version = String(process.env.BIAWS_STARTER_SKILLS_VERSION || "1.0.0");
  const workspace = await ensureDefaultWorkspace({
    userId: "starter-skills-seed",
  });
  const entries = await readdir(skillsDirectory, { withFileTypes: true });
  const result = { published: [], skipped: [] };

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const payload = await buildSkillPayload(
      path.join(skillsDirectory, entry.name),
      {
        version,
        changelog: "Catálogo inicial da distribuição open source",
      },
    );
    try {
      await publishSkill(payload, { workspaceId: workspace.id });
      result.published.push(`${payload.skillId}@${version}`);
    } catch (error) {
      if (error.statusCode !== 409) throw error;
      result.skipped.push(`${payload.skillId}@${version}`);
    }
  }

  console.log(
    `Starter skills: ${result.published.length} publicada(s), ${result.skipped.length} já existente(s).`,
  );
}

run()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(closeMongoClient);
