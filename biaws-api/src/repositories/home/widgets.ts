export interface WidgetField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  emptyLabel?: string;
  options?: { value: string; label: string }[];
}
export interface HomeWidget {
  id: string;
  category: string;
  label: string;
  description: string;
  permission: string;
  defaultSize: string;
  configuration: { fields: WidgetField[] };
}
export type WidgetConfiguration = Record<string, string>;
import type { Actor } from "../../types/http.js";
import { hasPermission } from "./support.js";

export const MAX_WIDGETS = 30;

export const DEFAULT_PENDING_TASKS_LIMIT = 6;

export const WIDGET_SIZES = new Set(["small", "medium-1", "medium-2", "large"]);

export const COMPLETED_TASK_STATUSES = ["Concluído", "Concluido", "Completed", "Done", "closed"];

export const HOME_WIDGET_CATALOG: readonly HomeWidget[] = Object.freeze([
  {
    id: "issues-period",
    category: "Chamados",
    label: "Chamados no período",
    description: "Quantidade de chamados recebidos na semana ou no mês atual.",
    permission: "issues.read",
    defaultSize: "small",
    configuration: {
      fields: [
        {
          key: "period",
          label: "Período",
          type: "select",
          required: true,
          options: [
            { value: "week", label: "Semana atual" },
            { value: "month", label: "Mês atual" },
          ],
        },
      ],
    },
  },
  {
    id: "open-issues-by-application",
    category: "Chamados",
    label: "Chamados abertos por aplicação",
    description: "Distribuição dos chamados em aberto pelos sistemas.",
    permission: "issues.read",
    defaultSize: "medium-2",
    configuration: { fields: [] },
  },
  {
    id: "open-issues-by-type",
    category: "Chamados",
    label: "Chamados abertos por tipo",
    description: "Distribuição dos chamados em aberto por tipo.",
    permission: "issues.read",
    defaultSize: "medium-2",
    configuration: { fields: [] },
  },
  {
    id: "pending-tasks",
    category: "Melhorias",
    label: "Tarefas pendentes",
    description: "Tarefas ainda não concluídas nas melhorias acessíveis.",
    permission: "demands.read",
    defaultSize: "medium-2",
    configuration: { fields: [] },
  },
  {
    id: "application-health",
    category: "Monitoramento",
    label: "Saúde das aplicações",
    description: "Runtimes monitorados agrupados por aplicação, componente e deployment.",
    permission: "runtimes.read",
    defaultSize: "medium-2",
    configuration: {
      fields: [
        {
          key: "applicationId",
          label: "Aplicação",
          type: "application",
          required: false,
          emptyLabel: "Todas as aplicações",
        },
        {
          key: "environment",
          label: "Ambiente do deployment",
          type: "select",
          required: false,
          emptyLabel: "Todos os ambientes",
          options: [
            { value: "development", label: "Desenvolvimento" },
            { value: "test", label: "Teste" },
            { value: "staging", label: "Homologação" },
            { value: "production", label: "Produção" },
            { value: "other", label: "Outro" },
          ],
        },
        {
          key: "componentId",
          label: "Componente",
          type: "component",
          required: false,
          emptyLabel: "Todos os componentes",
        },
        {
          key: "deploymentId",
          label: "Deployment",
          type: "deployment",
          required: false,
          emptyLabel: "Todos os deployments",
        },
        {
          key: "runtimeId",
          label: "Runtime",
          type: "runtime",
          required: false,
          emptyLabel: "Todos os runtimes",
        },
        {
          key: "presentation",
          label: "Apresentação",
          type: "select",
          required: true,
          options: [
            { value: "list", label: "Lista" },
            { value: "tabs", label: "Abas" },
          ],
        },
      ],
    },
  },
]);

export const widgetById = new Map(HOME_WIDGET_CATALOG.map((widget) => [widget.id, widget]));

export function defaultConfiguration(widgetId: string): WidgetConfiguration {
  if (widgetId === "issues-period") return { period: "week" };
  return {};
}

export function defaultHomeWidgets(actor: Partial<Actor> = {}) {
  const defaults: [string, WidgetConfiguration, string][] = [
    ["issues-period", { period: "week" }, "small"],
    ["issues-period", { period: "month" }, "small"],
    ["open-issues-by-application", {}, "medium-2"],
    ["open-issues-by-type", {}, "medium-2"],
    ["pending-tasks", {}, "medium-2"],
    [
      "application-health",
      {
        applicationId: "",
        componentId: "",
        deploymentId: "",
        environment: "",
        presentation: "list",
        runtimeId: "",
      },
      "medium-2",
    ],
  ];
  return defaults
    .filter(([widgetId]) => hasPermission(actor, widgetById.get(widgetId)!.permission))
    .map(([widgetId, config, size], index: number) => ({
      id: `default-${widgetId}-${index + 1}`,
      widgetId,
      size,
      config,
    }));
}
