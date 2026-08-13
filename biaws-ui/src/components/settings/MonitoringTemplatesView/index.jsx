import { Activity, Pencil, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import {
  createMonitoringTemplate,
  createMonitoringTemplateVersion,
  deleteMonitoringTemplateVersion,
  fetchMonitoringTemplates,
  fetchMonitoringTemplateUsage,
  previewMonitoringTemplate,
  setMonitoringTemplateActive,
  validateMonitoringTemplateVersion,
} from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import "../../../styles/features/monitoring-templates.css";
import { VersionRow } from "./components.jsx";
import { TemplateDialog } from "./TemplateDialog/index.jsx";
import {
  DEFAULT_PREVIEW_SAMPLE,
  monitoringTemplateDraft,
  monitoringTemplatePayload,
  monitoringTemplatePreviewPayload,
} from "./model.js";

export function MonitoringTemplatesView({ actor }) {
  const [templates, setTemplates] = useState([]);
  const [draft, setDraft] = useState(null);
  const [previewSample, setPreviewSample] = useState(
    JSON.stringify(DEFAULT_PREVIEW_SAMPLE, null, 2),
  );
  const [preview, setPreview] = useState(null);
  const [usageById, setUsageById] = useState({});
  const [validatedById, setValidatedById] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canManage =
    hasPermission(actor, "runtimes.update") &&
    actor.permissionScopes?.["runtimes.update"]?.workspace === true;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const templatePayload = await fetchMonitoringTemplates({ limit: 100 });
      setTemplates(templatePayload.items || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [actor.workspaceId]);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = monitoringTemplatePayload(draft);
      await (draft.id
        ? createMonitoringTemplateVersion(draft.id, payload)
        : createMonitoringTemplate(payload));
      setDraft(null);
      setPreview(null);
      setNotice(
        draft.id
          ? "Nova versão criada como rascunho."
          : "Template criado como rascunho.",
      );
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }
  async function runPreview() {
    setError("");
    setPreview(null);
    try {
      const payload = await previewMonitoringTemplate(
        monitoringTemplatePreviewPayload(draft, previewSample),
      );
      setPreview(payload.preview);
    } catch (previewError) {
      setError(previewError.message);
    }
  }
  async function changeStatus(template, version, active) {
    setError("");
    try {
      await setMonitoringTemplateActive(template.id, version.version, active);
      setNotice(active ? "Versão ativada e validada." : "Versão desativada.");
      await load();
    } catch (statusError) {
      setError(statusError.message);
    }
  }
  async function validateVersion(template, version) {
    setError("");
    try {
      const sample = version.definition?.input?.sample || {};
      const payload = await validateMonitoringTemplateVersion(
        template.id,
        version.version,
        sample,
      );
      setValidatedById((current) => ({
        ...current,
        [`${template.id}:${version.version}`]: true,
      }));
      setNotice(
        `Teste aprovado: ${payload.validation.result.status}${payload.validation.result.message ? ` · ${payload.validation.result.message}` : ""}`,
      );
    } catch (validationError) {
      setError(validationError.message);
    }
  }
  async function showUsage(template, version) {
    setError("");
    try {
      const payload = await fetchMonitoringTemplateUsage(
        template.id,
        version.version,
      );
      setUsageById((current) => ({
        ...current,
        [`${template.id}:${version.version}`]: payload.usage,
      }));
    } catch (usageError) {
      setError(usageError.message);
    }
  }
  async function archive(template, version) {
    if (!window.confirm(`Arquivar “${template.name}” v${version.version}?`))
      return;
    setError("");
    try {
      await deleteMonitoringTemplateVersion(template.id, version.version);
      setNotice("Versão arquivada.");
      await load();
    } catch (archiveError) {
      setError(
        archiveError.statusCode === 409
          ? "A versão está em uso por monitoramentos ou observações históricas e não pode ser arquivada."
          : archiveError.message,
      );
    }
  }

  return (
    <section className="monitoringTemplatesPage">
      <header className="monitoringTemplatesHero">
        <div>
          <span>Monitoramento</span>
          <h2>Templates</h2>
          <p>
            Interprete respostas REST e sinais externos com JSONata, contrato
            versionado e apresentação consistente. Shell usa código de término.
          </p>
        </div>
        <div>
          <button
            aria-label="Recarregar templates"
            className="iconButton"
            disabled={loading}
            onClick={load}
            type="button"
          >
            <RefreshCw size={16} />
          </button>
          {canManage ? (
            <button
              className="primaryButton"
              onClick={() => {
                const nextDraft = monitoringTemplateDraft();
                setDraft(nextDraft);
                setPreviewSample(nextDraft.inputSampleText);
                setPreview(null);
              }}
              type="button"
            >
              <Plus size={16} /> Novo template
            </button>
          ) : null}
        </div>
      </header>
      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="infoBox" role="status">
          {notice}
        </div>
      ) : null}
      {loading && !templates.length ? <p>Carregando templates…</p> : null}
      {!loading && !templates.length ? (
        <div className="emptyState">
          <Activity size={28} />
          <strong>Nenhum template cadastrado</strong>
          <span>
            Crie regras declarativas e teste-as com uma amostra sanitizada antes
            de ativar.
          </span>
        </div>
      ) : null}
      <div className="monitoringTemplatesGrid">
        {templates.map((template) => (
          <article className="monitoringTemplateCard" key={template.id}>
            <header>
              <div>
                <strong>{template.name}</strong>
                <small>{template.id}</small>
              </div>
              {canManage ? (
                <button
                  aria-label={`Editar ${template.name}`}
                  className="iconButton"
                  onClick={() => {
                    const nextDraft = monitoringTemplateDraft(template);
                    setDraft(nextDraft);
                    setPreviewSample(nextDraft.inputSampleText);
                    setPreview(null);
                  }}
                  type="button"
                >
                  <Pencil size={16} />
                </button>
              ) : null}
            </header>
            <p>{template.description || "Sem descrição."}</p>
            <ul>
              {template.versions.map((version) => (
                <VersionRow
                  canManage={canManage}
                  key={version.version}
                  onArchive={(item) => archive(template, item)}
                  onStatus={(item, active) =>
                    changeStatus(template, item, active)
                  }
                  onUsage={(item) => showUsage(template, item)}
                  onValidate={(item) => validateVersion(template, item)}
                  template={template}
                  usage={usageById[`${template.id}:${version.version}`]}
                  version={version}
                  validated={
                    validatedById[`${template.id}:${version.version}`] === true
                  }
                />
              ))}
            </ul>
          </article>
        ))}
      </div>
      {!canManage ? (
        <div className="catalogPermissionNotice">
          Consulta disponível. A administração exige permissão de atualização no
          workspace.
        </div>
      ) : null}
      {draft ? (
        <TemplateDialog
          draft={draft}
          onChange={setDraft}
          onClose={() => setDraft(null)}
          onPreview={runPreview}
          onSave={save}
          preview={preview}
          previewSample={previewSample}
          saving={saving}
          setPreviewSample={setPreviewSample}
        />
      ) : null}
    </section>
  );
}
