import { X } from "lucide-react";
import { useState } from "react";

import "../../../../styles/features/monitoring-dialogs.css";
import { TemplateContractTab } from "./tabs/TemplateContractTab.jsx";
import { TemplateGeneralTab } from "./tabs/TemplateGeneralTab.jsx";
import { TemplatePreviewTab } from "./tabs/TemplatePreviewTab.jsx";
import { TemplateTransformTab } from "./tabs/TemplateTransformTab.jsx";

const TEMPLATE_TABS = [
  { component: TemplateGeneralTab, key: "general", label: "Geral" },
  {
    component: TemplateTransformTab,
    key: "transformation",
    label: "Transformação",
  },
  {
    component: TemplateContractTab,
    key: "contract",
    label: "Contrato e apresentação",
  },
  { component: TemplatePreviewTab, key: "preview", label: "Teste" },
];

export function TemplateDialog({
  draft,
  onChange,
  onClose,
  onSave,
  onPreview,
  preview,
  previewSample,
  saving,
  setPreviewSample,
}) {
  const [activeTab, setActiveTab] = useState("general");
  const [previewing, setPreviewing] = useState(false);
  const update = (field, value) =>
    onChange((current) => ({ ...current, [field]: value }));
  const currentTab =
    TEMPLATE_TABS.find(({ key }) => key === activeTab) || TEMPLATE_TABS[0];
  const ActiveTab = currentTab.component;

  async function runPreview() {
    setPreviewing(true);
    try {
      await onPreview();
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div className="dialogBackdrop" role="presentation">
      <section
        aria-labelledby="monitoring-template-dialog-title"
        aria-modal="true"
        className="monitoringTemplateDialog monitoringTemplateTabbedDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>{draft.id ? "Nova versão" : "Novo template"}</span>
            <h2 id="monitoring-template-dialog-title">
              {draft.name || "Template de monitoramento"}
            </h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="monitoringTemplateDialogContent">
          <div
            aria-label="Seções do template"
            className="monitoringDialogTabs"
            role="tablist"
          >
            {TEMPLATE_TABS.map(({ key, label }) => (
              <button
                aria-controls={`monitoring-template-panel-${key}`}
                aria-selected={activeTab === key}
                id={`monitoring-template-tab-${key}`}
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
            aria-labelledby={`monitoring-template-tab-${currentTab.key}`}
            className="monitoringTemplateDialogBody"
            id={`monitoring-template-panel-${currentTab.key}`}
            role="tabpanel"
          >
            <ActiveTab
              draft={draft}
              onPreview={runPreview}
              preview={preview}
              previewing={previewing}
              previewSample={previewSample}
              saving={saving}
              setPreviewSample={setPreviewSample}
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
            disabled={saving || previewing}
            onClick={onSave}
            type="button"
          >
            {saving
              ? "Salvando…"
              : draft.id
                ? "Criar versão"
                : "Criar template"}
          </button>
        </footer>
      </section>
    </div>
  );
}
