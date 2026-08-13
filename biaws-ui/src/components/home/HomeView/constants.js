import { Activity, BarChart3, CheckCircle2, ClipboardList } from "lucide-react";

export const HOME_WIDGET_ICONS = {
  "issues-period": Activity,
  "open-issues-by-application": BarChart3,
  "open-issues-by-type": BarChart3,
  "pending-tasks": ClipboardList,
  "application-health": CheckCircle2,
};

export const MONITORING_STATUSES = [
  "unknown",
  "healthy",
  "degraded",
  "unavailable",
  "stopped",
];

export const EMPTY_MONITORING_FILTERS = {
  status: "",
  observedFrom: "",
  observedTo: "",
};
