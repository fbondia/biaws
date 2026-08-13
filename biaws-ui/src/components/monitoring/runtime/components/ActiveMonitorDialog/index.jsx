import { Braces, Terminal, X } from "lucide-react";
import { useState } from "react";

import "../../../../../styles/features/monitoring-dialogs.css";
import { useNestedDialogKeyboard } from "../support.jsx";
import { MonitorGeneralTab } from "./tabs/MonitorGeneralTab.jsx";
import { MonitorInterpretationTab } from "./tabs/MonitorInterpretationTab.jsx";
import { MonitorProviderTab } from "./tabs/MonitorProviderTab.jsx";

export function ActiveMonitorDialog({
  draft,
  onChange,
  onClose,
  onSave,
  saving,
  templates = [],
}) {
  const [activeTab, setActiveTab] = useState("general");
  const update = (name, value) =>
    onChange((current) => ({ ...current, [name]: value }));
  const dialogRef = useNestedDialogKeyboard(onClose, saving);
  const rest = draft.provider === "rest";
  const ProviderIcon = rest ? Braces : Terminal;
  const providerLabel = rest ? "API REST" : "Shell Script";
  const tabs = [
    {
      component: MonitorGeneralTab,
      key: "general",
      label: "Geral",
    },
    {
      component: MonitorProviderTab,
      key: "provider",
      label: providerLabel,
    },
    {
      component: MonitorInterpretationTab,
      key: "interpretation",
      label: rest ? "Interpretação" : "Resultado",
    },
  ];
  const currentTab = tabs.find(({ key }) => key === activeTab) || tabs[0];
  const ActiveTab = currentTab.component;

  return (
    <div className="dialogBackdrop catalogMonitoringNestedBackdrop">
      <section
        aria-labelledby="active-monitor-dialog-title"
        aria-modal="true"
        className="catalogMonitoringDialog catalogMonitoringTabbedDialog"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <div>
            <span>
              {draft.id ? "Editar" : "Novo"} monitoramento · {providerLabel}
            </span>
            <h2
              className="catalogMonitorDialogTitle"
              id="active-monitor-dialog-title"
            >
              <ProviderIcon aria-hidden="true" size={22} />
              {draft.name || `Configurar ${providerLabel}`}
            </h2>
          </div>
          <button
            aria-label="Fechar"
            autoFocus
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="catalogMonitoringDialogContent">
          <div
            aria-label="Seções do monitoramento"
            className="monitoringDialogTabs"
            role="tablist"
          >
            {tabs.map(({ key, label }) => (
              <button
                aria-controls={`active-monitor-panel-${key}`}
                aria-selected={activeTab === key}
                id={`active-monitor-tab-${key}`}
                key={key}
                onClick={() => setActiveTab(key)}
                role="tab"
                tabIndex={activeTab === key ? 0 : -1}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div
            aria-labelledby={`active-monitor-tab-${currentTab.key}`}
            className="catalogMonitoringDialogBody"
            id={`active-monitor-panel-${currentTab.key}`}
            role="tabpanel"
          >
            <ActiveTab
              draft={draft}
              onChange={onChange}
              rest={rest}
              templates={templates}
              update={update}
            />
          </div>
        </div>
        <footer>
          <button
            className="secondaryButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="primaryButton"
            disabled={saving}
            onClick={onSave}
            type="button"
          >
            {saving ? "Salvando..." : "Salvar monitoramento"}
          </button>
        </footer>
      </section>
    </div>
  );
}
