import {
  ClipboardList,
  ListChecks,
  CheckSquare,
  FileText,
  BriefcaseBusiness,
  LifeBuoy,
} from "lucide-react";

export const COLOR_LIST_KEYS = new Set(["demand.status", "demand.task-status"]);
export const EML_DETECTION_LIST_KEY = "issue.type";
export const DEFAULT_STATUS_COLORS = {
  foreground: "#475467",
  background: "#f2f4f7",
  border: "#d0d5dd",
};

export function clone(value) {
  return structuredClone(value);
}

export function newItem(list) {
  const order =
    Math.max(0, ...(list.items || []).map((item) => Number(item.order) || 0)) +
    10;
  const metadata = COLOR_LIST_KEYS.has(list.key)
    ? { ...DEFAULT_STATUS_COLORS }
    : list.key === EML_DETECTION_LIST_KEY
      ? { emlImport: { enabled: false, subjectPatterns: [] } }
      : {};
  return { value: "", label: "", active: true, order, metadata, _new: true };
}

export function detectEmlIssueType(subject, items = []) {
  let firstMatch = null;

  for (const item of [...items].sort(
    (left, right) => Number(left.order) - Number(right.order),
  )) {
    const detection = item.metadata?.emlImport;
    if (item.active === false || !detection || detection.enabled === false) {
      continue;
    }
    for (const pattern of detection.subjectPatterns || []) {
      let match;
      try {
        match = new RegExp(pattern, "iu").exec(String(subject || ""));
      } catch (error) {
        return {
          error: `Expressão inválida em ${item.label || item.value}: ${error.message}`,
        };
      }
      if (!match) continue;
      const result = {
        type: item.value,
        label: item.label || item.value,
        code: String(match.groups?.code || "")
          .trim()
          .toUpperCase(),
      };
      if (result.code) return result;
      firstMatch ||= result;
    }
  }

  return firstMatch || null;
}

export const LIST_ICONS = {
  "issue.type": ClipboardList,
  "issue.status": ListChecks,
  "demand.status": ListChecks,
  "demand.task-status": ClipboardList,
  "demand.checklist": CheckSquare,
  "demand.specification-sections": FileText,
};

export const LIST_GROUPS = [
  {
    key: "demand",
    label: "Demandas / Requests",
    description:
      "Opções do fluxo de demandas, tarefas, checklist e especificação.",
    icon: BriefcaseBusiness,
    matches: (list) => list.key.startsWith("demand."),
  },
  {
    key: "issue",
    label: "Suporte / Issues",
    description:
      "Opções usadas no cadastro, filtro e acompanhamento de issues.",
    icon: LifeBuoy,
    matches: (list) => list.key.startsWith("issue."),
  },
];

export function groupOptionLists(lists) {
  const groups = LIST_GROUPS.map((group) => ({
    ...group,
    lists: lists.filter(group.matches),
  })).filter((group) => group.lists.length);
  const knownKeys = new Set(
    groups.flatMap((group) => group.lists.map((list) => list.key)),
  );
  const ungroupedLists = lists.filter((list) => !knownKeys.has(list.key));

  if (ungroupedLists.length) {
    groups.push({
      key: "other",
      label: "Outras opções",
      description: "Listas compartilhadas ou ainda não associadas a um módulo.",
      icon: ListChecks,
      lists: ungroupedLists,
    });
  }

  return groups;
}
