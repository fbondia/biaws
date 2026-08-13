import { LayoutDashboard, Plus, Save, X } from "lucide-react";
import { useMemo, useState } from "react";

import { HOME_WIDGET_ICONS } from "../constants.js";

export function ConfigurationDialog({
  applications,
  definition,
  instance,
  onClose,
  onConfirm,
}) {
  const [config, setConfig] = useState(() => ({
    ...(instance?.config || {}),
  }));
  const selectedApplication = applications.find(
    ({ id }) => id === config.applicationId,
  );
  const selectedComponent = selectedApplication?.components?.find(
    ({ id }) => id === config.componentId,
  );
  const selectedDeployment = selectedComponent?.deployments?.find(
    ({ id }) => id === config.deploymentId,
  );

  function fieldOptions(field) {
    if (field.type === "application") return applications;
    if (field.type === "component")
      return selectedApplication?.components || [];
    if (field.type === "deployment")
      return selectedComponent?.deployments || [];
    if (field.type === "runtime") return selectedDeployment?.runtimes || [];
    return field.options || [];
  }

  function fieldIsVisible(field) {
    if (field.type === "component") return Boolean(selectedApplication);
    if (field.type === "deployment") return Boolean(selectedComponent);
    if (field.type === "runtime") return Boolean(selectedDeployment);
    return true;
  }

  function updateConfigurationField(field, value) {
    setConfig((current) => {
      const next = { ...current, [field.key]: value };
      if (field.type === "application") {
        next.componentId = "";
        next.deploymentId = "";
        next.runtimeId = "";
      } else if (field.type === "component") {
        next.deploymentId = "";
        next.runtimeId = "";
      } else if (field.type === "deployment") {
        next.runtimeId = "";
      } else if (field.type === "runtime" && value) {
        next.presentation = "tabs";
      }
      return next;
    });
  }

  return (
    <div className="dialogBackdrop homeDialogBackdrop">
      <section
        aria-modal="true"
        className="homeConfigurationDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Configurar widget</span>
            <h2>{definition.label}</h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="homeConfigurationFields">
          {(definition.configuration?.fields || [])
            .filter(fieldIsVisible)
            .map((field) => (
              <label className="field" key={field.key}>
                <span>{field.label}</span>
                <select
                  disabled={field.key === "presentation" && config.runtimeId}
                  onChange={(event) =>
                    updateConfigurationField(field, event.target.value)
                  }
                  value={config[field.key] || ""}
                >
                  {!field.required ? (
                    <option value="">
                      {field.emptyLabel || "Não informado"}
                    </option>
                  ) : null}
                  {fieldOptions(field).map((option) => (
                    <option
                      key={option.value || option.id}
                      value={option.value || option.id}
                    >
                      {option.label || option.name}
                    </option>
                  ))}
                </select>
                {field.key === "presentation" && config.runtimeId ? (
                  <small className="homeConfigurationHint">
                    Um runtime específico é apresentado diretamente com seus
                    metadados.
                  </small>
                ) : null}
              </label>
            ))}
        </div>
        <footer>
          <button className="secondaryButton" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="primaryButton"
            onClick={() => onConfirm(config)}
            type="button"
          >
            <Save size={16} /> Aplicar
          </button>
        </footer>
      </section>
    </div>
  );
}

export function WidgetCatalog({ catalog, onAdd, onClose }) {
  const categories = useMemo(
    () =>
      Object.entries(
        catalog.reduce((result, widget) => {
          (result[widget.category] ||= []).push(widget);
          return result;
        }, {}),
      ),
    [catalog],
  );

  return (
    <div
      className="homeCatalogBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside className="homeWidgetCatalog">
        <header>
          <div>
            <span>Catálogo</span>
            <h2>Adicionar widget</h2>
          </div>
          <button
            aria-label="Fechar catálogo"
            className="iconButton"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>
        <div className="homeWidgetCatalogContent">
          {categories.map(([category, widgets]) => (
            <section key={category}>
              <h3>{category}</h3>
              {widgets.map((widget) => {
                const Icon = HOME_WIDGET_ICONS[widget.id] || LayoutDashboard;
                return (
                  <button
                    className="homeCatalogWidget"
                    key={widget.id}
                    onClick={() => onAdd(widget)}
                    type="button"
                  >
                    <span>
                      <Icon size={18} />
                    </span>
                    <div>
                      <strong>{widget.label}</strong>
                      <small>{widget.description}</small>
                    </div>
                    <Plus size={17} />
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}
