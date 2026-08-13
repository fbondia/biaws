import { Braces, Terminal, X } from "lucide-react";
import React from "react";

import { TextField } from "../Fields.jsx";
import {
  MonitorFormSection,
  RestMonitorFields,
  ShellMonitorFields,
  TemplateFields,
} from "./ActiveMonitorFields.jsx";
import { useNestedDialogKeyboard } from "./support.jsx";

export function ActiveMonitorDialog({
  draft,
  onChange,
  onClose,
  onSave,
  saving,
  templates = [],
}) {
  const update = (name, value) =>
    onChange((current) => ({ ...current, [name]: value }));
  const dialogRef = useNestedDialogKeyboard(onClose, saving);
  const rest = draft.provider === "rest";
  const ProviderIcon = rest ? Braces : Terminal;
  const providerLabel = rest ? "API REST" : "Shell Script";
  return (
    <div className="dialogBackdrop catalogMonitoringNestedBackdrop">
      <section
        aria-labelledby="active-monitor-dialog-title"
        aria-modal="true"
        className="catalogMonitoringDialog"
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
        <div className="catalogMonitoringDialogBody">
          <MonitorFormSection
            description="Identifique o monitoramento e controle seu estado."
            title="Identificação"
          >
            <TextField
              label="Nome"
              name="name"
              onChange={update}
              required
              value={draft.name}
            />
            <label className="field catalogMonitoringCheck">
              <input
                checked={draft.enabled}
                onChange={(event) => update("enabled", event.target.checked)}
                type="checkbox"
              />
              <span>Monitoramento ativo</span>
            </label>
            <label className="field catalogWideField">
              <span>Descrição</span>
              <textarea
                onChange={(event) => update("description", event.target.value)}
                rows={2}
                value={draft.description}
              />
            </label>
          </MonitorFormSection>
          <MonitorFormSection
            description="Defina a frequência e o limite de cada execução."
            title="Agendamento"
          >
            <TextField
              label="Intervalo (segundos)"
              name="intervalSeconds"
              onChange={update}
              type="number"
              value={draft.intervalSeconds}
            />
            <TextField
              label="Timeout (segundos)"
              name="timeoutSeconds"
              onChange={update}
              type="number"
              value={draft.timeoutSeconds}
            />
          </MonitorFormSection>
          <MonitorFormSection
            description={
              rest
                ? "Configure a requisição e os critérios básicos da resposta."
                : "Informe somente scripts previamente permitidos no executor."
            }
            title={rest ? "Requisição REST" : "Execução do script"}
          >
            {rest ? (
              <RestMonitorFields draft={draft} update={update} />
            ) : (
              <ShellMonitorFields draft={draft} update={update} />
            )}
          </MonitorFormSection>
          <MonitorFormSection
            description="Associe uma versão específica para interpretar a evidência."
            title="Interpretação"
          >
            <TemplateFields
              draft={draft}
              onChange={onChange}
              templates={templates}
            />
          </MonitorFormSection>
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
