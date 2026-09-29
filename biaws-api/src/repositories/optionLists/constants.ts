import {
  DEFAULT_REQUEST_STATUS,
  DEFAULT_REQUEST_TASK_STATUS,
  REQUEST_CHECKLIST_ITEMS,
  REQUEST_SPECIFICATION_SECTION_TITLES,
  REQUEST_STATUS_COLORS,
  REQUEST_TASK_STATUS_COLORS,
} from "../../../../shared/requestConstants.js";
import {
  DEFAULT_ISSUE_STATUS,
  DEFAULT_ISSUE_TYPE,
  ISSUE_STATUS_OPTIONS,
  ISSUE_TYPE_OPTIONS,
} from "../../../../shared/issueConstants.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { DEFAULT_ISSUE_TYPE_DETECTION } from "../../helpers/issueTypeDetection.js";

export const OPTION_LISTS_COLLECTION = COLLECTION_NAMES.OPTION_LISTS;

export const OPTION_LIST_KEYS = Object.freeze({
  ISSUE_TYPE: "issue.type",
  ISSUE_STATUS: "issue.status",
  DEMAND_STATUS: "demand.status",
  TASK_STATUS: "demand.task-status",
  CHECKLIST: "demand.checklist",
  SPECIFICATION_SECTIONS: "demand.specification-sections",
});

export const KEY_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

export const DEFAULT_OPTION_LISTS = Object.freeze([
  {
    key: OPTION_LIST_KEYS.ISSUE_TYPE,
    name: "Tipos de chamados",
    description:
      "Tipos disponíveis para cadastro, importação e filtro de chamados.",
    defaultValue: DEFAULT_ISSUE_TYPE,
    items: ISSUE_TYPE_OPTIONS.map((item, index: number) => ({
      ...item,
      active: true,
      order: (index + 1) * 10,
      metadata: {
        emlImport: DEFAULT_ISSUE_TYPE_DETECTION[
          item.value as keyof typeof DEFAULT_ISSUE_TYPE_DETECTION
        ] || {
          enabled: false,
          subjectPatterns: [],
        },
      },
    })),
  },
  {
    key: OPTION_LIST_KEYS.ISSUE_STATUS,
    name: "Status de chamados",
    description:
      "Situações disponíveis para cadastro, edição e filtro de chamados.",
    defaultValue: DEFAULT_ISSUE_STATUS,
    items: ISSUE_STATUS_OPTIONS.map((item, index: number) => ({
      ...item,
      active: true,
      order: (index + 1) * 10,
      metadata: {},
    })),
  },
  {
    key: OPTION_LIST_KEYS.DEMAND_STATUS,
    name: "Status de melhorias",
    description: "Situações disponíveis para uma melhoria.",
    defaultValue: DEFAULT_REQUEST_STATUS,
    items: Object.entries(REQUEST_STATUS_COLORS).map(
      ([value, metadata], index: number) => ({
        value,
        label: value,
        active: true,
        order: (index + 1) * 10,
        metadata,
      }),
    ),
  },
  {
    key: OPTION_LIST_KEYS.TASK_STATUS,
    name: "Status de tarefas",
    description: "Situações disponíveis para tarefas de melhorias.",
    defaultValue: DEFAULT_REQUEST_TASK_STATUS,
    items: Object.entries(REQUEST_TASK_STATUS_COLORS).map(
      ([value, metadata], index: number) => ({
        value,
        label: value,
        active: true,
        order: (index + 1) * 10,
        metadata,
      }),
    ),
  },
  {
    key: OPTION_LIST_KEYS.CHECKLIST,
    name: "Checklist de melhorias",
    description:
      "Etapas criadas automaticamente no checklist de novas melhorias.",
    defaultValue: "",
    items: REQUEST_CHECKLIST_ITEMS.map((value: unknown, index: number) => ({
      value,
      label: value,
      active: true,
      order: (index + 1) * 10,
      metadata: {},
    })),
  },
  {
    key: OPTION_LIST_KEYS.SPECIFICATION_SECTIONS,
    name: "Seções da especificação",
    description: "Seções criadas automaticamente na especificação técnica.",
    defaultValue: "",
    items: REQUEST_SPECIFICATION_SECTION_TITLES.map(
      (value: unknown, index: number) => ({
        value,
        label: value,
        active: true,
        order: (index + 1) * 10,
        metadata: {},
      }),
    ),
  },
]);

export const DEFAULT_COLOR_METADATA = {
  [OPTION_LIST_KEYS.DEMAND_STATUS]: REQUEST_STATUS_COLORS,
  [OPTION_LIST_KEYS.TASK_STATUS]: REQUEST_TASK_STATUS_COLORS,
};
