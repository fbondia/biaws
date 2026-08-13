import { hasPermission } from "../../../permissions.js";

export const CATALOG_TABS = [
  { key: "overview", label: "Visão geral", permission: "applications.read" },
  {
    key: "topology",
    label: "Topologia",
    permission: ["components.read", "deployments.read"],
  },
  {
    key: "repositories",
    label: "Repositórios",
    permission: "repositories.read",
  },
  {
    key: "integrations",
    label: "Integrações",
    permission: "integrations.read",
  },
  { key: "history", label: "Histórico", permission: "applications.read" },
];

export function visibleCatalogTabs(actor) {
  return CATALOG_TABS.filter(({ permission }) =>
    (Array.isArray(permission) ? permission : [permission]).some((candidate) =>
      hasPermission(actor, candidate),
    ),
  );
}
