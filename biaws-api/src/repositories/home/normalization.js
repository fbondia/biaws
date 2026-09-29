import { homeError, hasPermission } from "./support.js";
import {
  MAX_WIDGETS,
  widgetById,
  WIDGET_SIZES,
  defaultConfiguration,
} from "./widgets.js";
import { randomUUID } from "node:crypto";
import { DEPLOYMENT_ENVIRONMENTS } from "../../../../shared/index.js";

function normalizeIssuesPeriodConfiguration(value) {
  const period = String(value.period || "week");
  if (!["week", "month"].includes(period)) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      "period must be week or month",
    );
  }
  return { period };
}

function normalizeApplicationHealthConfiguration(value) {
  const environment = String(value.environment || "").trim();
  const applicationId = String(value.applicationId || "").trim();
  const componentId = String(value.componentId || "").trim();
  const deploymentId = String(value.deploymentId || "").trim();
  const runtimeId = String(value.runtimeId || "").trim();
  const requestedPresentation = String(value.presentation || "list").trim();
  if (environment && !DEPLOYMENT_ENVIRONMENTS.includes(environment)) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      `environment must be one of: ${DEPLOYMENT_ENVIRONMENTS.join(", ")}`,
    );
  }
  if (!["list", "tabs"].includes(requestedPresentation)) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      "presentation must be list or tabs",
    );
  }
  if (
    (componentId && !applicationId) ||
    (deploymentId && !componentId) ||
    (runtimeId && !deploymentId)
  ) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      "application health filters must follow application, component, deployment and runtime hierarchy",
    );
  }
  return {
    applicationId,
    componentId,
    deploymentId,
    environment,
    presentation: runtimeId ? "tabs" : requestedPresentation,
    runtimeId,
  };
}

function normalizeConfiguration(widget, value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      "widget config must be an object",
    );
  }
  const allowed = new Set(
    (widget.configuration?.fields || []).map(({ key }) => key),
  );
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      `unknown ${widget.id} configuration fields: ${unknown.join(", ")}`,
    );
  }
  if (widget.id === "issues-period") {
    return normalizeIssuesPeriodConfiguration(value);
  }
  if (widget.id === "application-health") {
    return normalizeApplicationHealthConfiguration(value);
  }
  return {};
}

export function normalizeHomeWidgets(value, actor = {}) {
  if (!Array.isArray(value) || value.length > MAX_WIDGETS) {
    throw homeError(
      422,
      "INVALID_HOME_CONFIGURATION",
      `widgets must be an array with at most ${MAX_WIDGETS} items`,
    );
  }
  const ids = new Set();
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw homeError(
        422,
        "INVALID_HOME_CONFIGURATION",
        `widgets[${index}] must be an object`,
      );
    }
    const widget = widgetById.get(String(item.widgetId || ""));
    if (!widget || !hasPermission(actor, widget.permission)) {
      throw homeError(
        422,
        "INVALID_HOME_WIDGET",
        `widget is unavailable: ${item.widgetId || "unknown"}`,
      );
    }
    const id = String(item.id || randomUUID()).trim();
    if (!id || id.length > 128 || ids.has(id)) {
      throw homeError(
        422,
        "INVALID_HOME_CONFIGURATION",
        `widgets[${index}].id must be unique`,
      );
    }
    ids.add(id);
    const requestedSize = String(item.size || widget.defaultSize);
    const size = requestedSize === "medium" ? "medium-2" : requestedSize;
    if (!WIDGET_SIZES.has(size)) {
      throw homeError(
        422,
        "INVALID_HOME_CONFIGURATION",
        `widgets[${index}].size is invalid`,
      );
    }
    return {
      id,
      widgetId: widget.id,
      size,
      config: normalizeConfiguration(
        widget,
        item.config ?? defaultConfiguration(widget.id),
      ),
    };
  });
}
