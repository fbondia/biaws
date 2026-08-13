import { Eye, Trash2, X } from "lucide-react";

import { templateStatusLabel } from "./model.js";

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
  const update = (field, value) =>
    onChange((current) => ({ ...current, [field]: value }));
  return (
    <div className="dialogBackdrop" role="presentation">
      <section
        aria-labelledby="monitoring-template-dialog-title"
        aria-modal="true"
        className="monitoringTemplateDialog"
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
        <div className="monitoringTemplateDialogBody">
          <label className="field">
            <span>Nome</span>
            <input
              onChange={(event) => update("name", event.target.value)}
              required
              value={draft.name}
            />
          </label>
          <label className="field">
            <span>Descrição</span>
            <textarea
              onChange={(event) => update("description", event.target.value)}
              rows={2}
              value={draft.description}
            />
          </label>
          <label className="field">
            <span>Amostra JSON de entrada</span>
            <textarea
              className="monitoringTemplateCode"
              onChange={(event) =>
                update("inputSampleText", event.target.value)
              }
              rows={7}
              spellCheck="false"
              value={draft.inputSampleText}
            />
            <small>
              JSON sanitizado usado como documentação e teste padrão da versão.
            </small>
          </label>
          <label className="field">
            <span>Expressão JSONata</span>
            <textarea
              className="monitoringTemplateCode"
              onChange={(event) => update("expression", event.target.value)}
              rows={8}
              spellCheck="false"
              value={draft.expression}
            />
            <small>
              Produza um objeto com status, message e metadata. Exemplo:{" "}
              {`{"status": up ? "healthy" : "unavailable", "metadata": {}}`}.
            </small>
          </label>
          <label className="field">
            <span>Contrato JSON da saída</span>
            <textarea
              className="monitoringTemplateCode"
              onChange={(event) => update("outputText", event.target.value)}
              rows={12}
              spellCheck="false"
              value={draft.outputText}
            />
          </label>
          <label className="field">
            <span>Apresentação dos campos e séries</span>
            <textarea
              className="monitoringTemplateCode"
              onChange={(event) =>
                update("presentationText", event.target.value)
              }
              rows={10}
              spellCheck="false"
              value={draft.presentationText}
            />
          </label>
          {draft.migratedFromLegacy ? (
            <div className="infoBox">
              Esta nova versão parte do contrato unificado. Revise a amostra, a
              expressão JSONata e a apresentação antes de salvar.
            </div>
          ) : null}
          <div className="monitoringTemplatePreviewGrid">
            <label className="field">
              <span>Amostra sanitizada</span>
              <textarea
                className="monitoringTemplateCode"
                onChange={(event) => setPreviewSample(event.target.value)}
                rows={9}
                spellCheck="false"
                value={previewSample}
              />
            </label>
            <section
              aria-live="polite"
              className="monitoringTemplatePreviewResult"
            >
              <strong>Pré-visualização</strong>
              {preview ? (
                <>
                  <span
                    className={`catalogStatus catalogStatus-${preview.result.status === "healthy" ? "active" : "archived"}`}
                  >
                    {preview.result.status}
                  </span>
                  <p>{preview.result.message || "Sem mensagem"}</p>
                  <small>
                    {preview.matchedRule
                      ? `Regra: ${preview.matchedRule.label}`
                      : "Resultado padrão"}
                  </small>
                  <pre>{JSON.stringify(preview.diagnostics, null, 2)}</pre>
                </>
              ) : (
                <p>
                  Execute o teste para visualizar o resultado e o diagnóstico,
                  sem registrar observação.
                </p>
              )}
            </section>
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
            className="secondaryButton"
            disabled={saving}
            onClick={onPreview}
            type="button"
          >
            <Eye size={16} /> Testar
          </button>
          <button
            className="primaryButton"
            disabled={saving}
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

export function VersionRow({
  canManage,
  onArchive,
  onStatus,
  onUsage,
  onValidate,
  template,
  usage,
  version,
  validated,
}) {
  return (
    <li>
      <div>
        <strong>v{version.version}</strong>
        <span
          className={`catalogStatus catalogStatus-${version.status === "active" ? "active" : "archived"}`}
        >
          {templateStatusLabel(version.status)}
        </span>
        <small>{new Date(version.updatedAt).toLocaleString("pt-BR")}</small>
      </div>
      <div className="monitoringTemplateVersionActions">
        <button
          className="secondaryButton"
          onClick={() => onUsage(version)}
          type="button"
        >
          Uso
        </button>
        <button
          className="secondaryButton"
          onClick={() => onValidate(version)}
          type="button"
        >
          {validated ? "Teste aprovado" : "Testar versão"}
        </button>
        {canManage ? (
          <button
            className="secondaryButton"
            disabled={version.status !== "active" && !validated}
            onClick={() => onStatus(version, version.status !== "active")}
            type="button"
          >
            {version.status === "active" ? "Desativar" : "Ativar"}
          </button>
        ) : null}
        {canManage && version.status !== "active" ? (
          <button
            aria-label={`Arquivar ${template.name} versão ${version.version}`}
            className="iconButton dangerIconButton"
            onClick={() => onArchive(version)}
            type="button"
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>
      {usage?.templateRef?.version === version.version ? (
        <p className="monitoringTemplateUsage">
          {usage.monitors ?? usage.activeMonitors} monitoramento(s) ·{" "}
          {usage.observations} observação(ões) histórica(s)
        </p>
      ) : null}
    </li>
  );
}
