import { fetchJson, sendJson } from "./client.js";

export function fetchSkills(params) {
  return fetchJson("/api/skills", params);
}

export function fetchSkill(skillId, version, params) {
  return fetchJson(`/api/skills/${encodeURIComponent(skillId)}`, {
    ...params,
    version,
  });
}

export function fetchSkillPackage(skillId, version) {
  return fetchJson(
    `/api/skills/${encodeURIComponent(skillId)}/${encodeURIComponent(version)}/download`,
  );
}

export function publishSkill(skill, params) {
  return sendJson("/api/skills", skill, params, "POST");
}

export function deprecateSkill(skillId, version, params) {
  return sendJson(
    `/api/skills/${encodeURIComponent(skillId)}/${encodeURIComponent(version)}/deprecate`,
    {},
    params,
    "PATCH",
  );
}

export async function downloadSkillPackage(skillId, version) {
  const payload = await fetchSkillPackage(skillId, version);
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/vnd.biaws.skill+json",
  });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `${skillId}-${version}.skill.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}
