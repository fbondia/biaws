import * as api from "../api.js";

export function requireEntity(value) {
  if (!value) throw new Error("Registro não encontrado ou sem acesso.");
  return value;
}
export function findEntity(items, reference, identifier = "identifier") {
  const byId = items.find((item) => [item.id, item._id].some((id) => String(id || "") === reference));
  if (byId) return byId;
  const matches = items.filter(
    (item) => String(item[identifier] || "").toLocaleLowerCase("pt-BR") === reference.toLocaleLowerCase("pt-BR"),
  );
  if (matches.length > 1) throw new Error("Identificador ambíguo. Use o ID do registro.");
  return requireEntity(matches[0]);
}
export async function loadSkill(reference) {
  const { skill } = await api.fetchSkill(reference, undefined, { includeDeprecated: true });
  requireEntity(skill);
  const { items } = await api.fetchSkills({ includeDeprecated: true });
  const selected = requireEntity(items.find((item) => item.skillId === skill.skillId));
  return { ...selected, latestVersion: skill.version };
}
