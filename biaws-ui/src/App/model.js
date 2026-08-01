import {
  ClipboardList,
  ListChecks,
  CheckSquare,
  FileText,
  BriefcaseBusiness,
  List,
  Tags,
  Layers3,
  Package,
  Users,
  ShieldCheck,
  Server,
  BookOpen,
  LifeBuoy,
  House,
} from "lucide-react";

export const APP_VIEWS = [
  {
    key: "home",
    label: "Início",
    icon: House,
    permission: null,
  },
  {
    key: "issues",
    label: "Chamados",
    icon: ListChecks,
    permission: "issues.read",
  },
  {
    key: "requests",
    label: "Melhorias",
    icon: BriefcaseBusiness,
    permission: "demands.read",
  },
  {
    key: "procedures",
    label: "Procedimentos",
    icon: BookOpen,
    permission: "procedures.read",
  },
];

export const SETTINGS_VIEWS = [
  {
    key: "catalog",
    label: "Aplicações",
    icon: Layers3,
    permission: "applications.read",
  },
  {
    key: "servers",
    label: "Servidores",
    icon: Server,
    permission: "servers.read",
  },
  {
    key: "option-lists",
    label: "Listas de Opções",
    icon: List,
    permission: "option_lists.read",
  },
  {
    key: "taxonomy",
    label: "Taxonomia",
    icon: Tags,
    permission: "taxonomy.read",
  },
  { key: "skills", label: "Skills", icon: Package, permission: "skills.read" },
  { key: "users", label: "Usuários", icon: Users, permission: "users.read" },
  {
    key: "groups",
    label: "Grupos",
    icon: ShieldCheck,
    permission: "roles.read",
  },
];

export const ISSUES_PER_PAGE = 25;
export const DEFAULT_ISSUE_SORT = "-date";

export function compactSummaryParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => value !== "" && value !== undefined && value !== null,
    ),
  );
}

export function monthBounds(monthKey) {
  const [year, month] = String(monthKey || "")
    .split("-")
    .map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function buildMonthSummaryParams(filters, monthKey) {
  const bounds = monthBounds(monthKey);

  if (!bounds) return null;

  return compactSummaryParams({
    ...filters,
    from:
      filters.from && filters.from > bounds.from ? filters.from : bounds.from,
    to: filters.to && filters.to < bounds.to ? filters.to : bounds.to,
  });
}
