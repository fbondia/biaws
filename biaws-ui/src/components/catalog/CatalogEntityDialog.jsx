import { Save, X } from "lucide-react";
import { useState } from "react";

import { MarkdownEditor } from "../shared/MarkdownEditor/index.jsx";
import {
  CATALOG_ENTITY_LABELS,
  catalogEntityDraft,
  catalogEntityPayload,
} from "./catalogModel.js";

const COMPONENT_TYPES = [
  "api",
  "ui",
  "worker",
  "service",
  "library",
  "integration",
  "other",
];
const REPOSITORY_PROVIDERS = [
  "github",
  "gitlab",
  "bitbucket",
  "azure-devops",
  "local",
  "other",
];
const ENVIRONMENTS = ["development", "test", "staging", "production", "other"];
const DEPLOYMENT_STATUSES = [
  "planned",
  "deploying",
  "active",
  "inactive",
  "failed",
];
const RUNTIME_KINDS = [
  "process",
  "container",
  "kubernetes",
  "serverless",
  "managed",
  "external",
  "other",
];
const RUNTIME_STATUSES = [
  "unknown",
  "healthy",
  "degraded",
  "unavailable",
  "stopped",
];
const SERVER_STATUSES = ["active", "maintenance", "retired"];

function SelectField({
  className = "",
  label,
  name,
  onChange,
  options,
  required,
  value,
}) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      <select
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        required={required}
        value={value || ""}
      >
        {!required ? <option value="">Não informado</option> : null}
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { value: option, label: option }
              : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function TextField({
  className = "",
  disabled,
  label,
  name,
  onChange,
  placeholder,
  readOnly,
  required,
  type = "text",
  value,
}) {
  return (
    <label className={`field ${className}`.trim()}>
      <span>{label}</span>
      <input
        disabled={disabled}
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        type={type}
        value={value ?? ""}
      />
    </label>
  );
}

function MultiSelectField({ label, name, onChange, options, value = [] }) {
  return (
    <label className="field catalogWideField">
      <span>{label}</span>
      <select
        aria-describedby={`${name}-help`}
        multiple
        onChange={(event) =>
          onChange(
            name,
            [...event.target.selectedOptions].map(({ value: id }) => id),
          )
        }
        value={value}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
      <small id={`${name}-help`}>
        Use Ctrl ou Command para selecionar vários itens.
      </small>
    </label>
  );
}

function formatDate(value) {
  if (!value) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function HistoryItems({ empty, items, renderItem }) {
  if (!items.length) return <div className="catalogHistoryEmpty">{empty}</div>;
  return (
    <div className="catalogHistoryItems">
      {items.map((item) => (
        <article className="catalogHistoryItem" key={item.id}>
          {renderItem(item)}
        </article>
      ))}
    </div>
  );
}

export function CatalogEntityDialog({
  entity,
  kind,
  onClose,
  onSave,
  options = {},
}) {
  const editing = Boolean(entity?.id);
  const [draft, setDraft] = useState(() => catalogEntityDraft(kind, entity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState("basic");
  const [publicationDraft, setPublicationDraft] = useState({
    version: "",
    revision: "",
    publishedAt: "",
    description: "",
  });
  const [observationDraft, setObservationDraft] = useState({
    healthStatus: "unknown",
    observedAt: "",
    source: "",
    message: "",
  });
  const label = CATALOG_ENTITY_LABELS[kind];
  const sections =
    kind === "deployment"
      ? [
          ["basic", "Dados básicos"],
          ["publications", "Publicações"],
        ]
      : kind === "runtime"
        ? [
            ["basic", "Dados básicos"],
            ["service", "Serviço"],
            ["monitoring", "Monitoramento"],
            ["procedure", "Procedimento"],
          ]
        : [];

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function addPublication() {
    if (!publicationDraft.version.trim()) return;
    update("publications", [
      ...(draft.publications || []),
      {
        id: `draft-${crypto.randomUUID()}`,
        version: publicationDraft.version.trim(),
        revision: publicationDraft.revision.trim(),
        repositoryId: draft.repositoryId || "",
        publishedAt: publicationDraft.publishedAt
          ? new Date(publicationDraft.publishedAt).toISOString()
          : new Date().toISOString(),
        description: publicationDraft.description.trim(),
      },
    ]);
    setPublicationDraft({
      version: "",
      revision: "",
      publishedAt: "",
      description: "",
    });
  }

  function addObservation() {
    if (!observationDraft.observedAt) return;
    update("observations", [
      ...(draft.observations || []),
      {
        id: `draft-${crypto.randomUUID()}`,
        healthStatus: observationDraft.healthStatus,
        observedAt: new Date(observationDraft.observedAt).toISOString(),
        source: observationDraft.source.trim(),
        message: observationDraft.message.trim(),
        metadata: {},
      },
    ]);
    setObservationDraft({
      healthStatus: "unknown",
      observedAt: "",
      source: "",
      message: "",
    });
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(catalogEntityPayload(kind, draft, editing));
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        aria-labelledby="catalog-entity-dialog-title"
        aria-modal="true"
        className="catalogEntityDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>{editing ? `Editar ${label}` : `Novo ${label}`}</span>
            <h2 id="catalog-entity-dialog-title">
              {draft.name || `Novo ${label}`}
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
        <form onSubmit={submit}>
          {sections.length ? (
            <div className="catalogEntityTabs" role="tablist">
              {sections.map(([key, title]) => (
                <button
                  aria-selected={activeSection === key}
                  className={
                    activeSection === key
                      ? "catalogEntityTab activeCatalogEntityTab"
                      : "catalogEntityTab"
                  }
                  disabled={!editing && key !== "basic"}
                  key={key}
                  onClick={() => setActiveSection(key)}
                  role="tab"
                  type="button"
                >
                  {title}
                </button>
              ))}
            </div>
          ) : null}
          <div className="catalogFormGrid">
            {!editing && (!sections.length || activeSection === "basic") ? (
              <TextField
                label="Chave"
                name="key"
                onChange={update}
                placeholder="exemplo-estavel"
                required
                value={draft.key}
              />
            ) : null}
            {kind !== "repository" &&
            (!sections.length || activeSection === "basic") ? (
              <TextField
                label="Nome"
                name="name"
                onChange={update}
                required
                value={draft.name}
              />
            ) : null}

            {kind === "application" ? (
              <>
                <TextField
                  label="Equipe responsável"
                  name="ownerTeam"
                  onChange={update}
                  value={draft.ownerTeam}
                />
                <TextField
                  label="Contato"
                  name="ownerContact"
                  onChange={update}
                  value={draft.ownerContact}
                />
                <TextField
                  label="Tags, separadas por vírgula"
                  name="tagsText"
                  onChange={update}
                  value={draft.tagsText}
                />
              </>
            ) : null}

            {kind === "component" ? (
              <>
                <SelectField
                  label="Tipo"
                  name="type"
                  onChange={update}
                  options={COMPONENT_TYPES}
                  required
                  value={draft.type}
                />
                <TextField
                  label="Tags, separadas por vírgula"
                  name="tagsText"
                  onChange={update}
                  value={draft.tagsText}
                />
                <MultiSelectField
                  label="Repositórios"
                  name="repositoryIds"
                  onChange={update}
                  options={options.repositories || []}
                  value={draft.repositoryIds}
                />
                <MultiSelectField
                  label="Dependências"
                  name="dependencyIds"
                  onChange={update}
                  options={(options.components || []).filter(
                    ({ id }) => id !== entity?.id,
                  )}
                  value={draft.dependencyIds}
                />
              </>
            ) : null}

            {kind === "integration" ? (
              <>
                {!editing ? (
                  <SelectField
                    label="Aplicação integrada"
                    name="targetApplicationId"
                    onChange={update}
                    options={(options.applications || []).map(
                      ({ id, name }) => ({
                        value: id,
                        label: name,
                      }),
                    )}
                    required
                    value={draft.targetApplicationId}
                  />
                ) : (
                  <TextField
                    disabled
                    label="Aplicação integrada"
                    name="targetApplicationName"
                    onChange={() => {}}
                    value={
                      (options.applications || []).find(
                        ({ id }) => id === draft.targetApplicationId,
                      )?.name || draft.targetApplicationId
                    }
                  />
                )}
              </>
            ) : null}

            {kind === "repository" ? (
              <div className="catalogRepositoryForm">
                <TextField
                  className="catalogRepositoryPrimaryField"
                  label="Nome"
                  name="name"
                  onChange={update}
                  required
                  value={draft.name}
                />
                <TextField
                  className="catalogRepositoryPrimaryField"
                  label="URL HTTP(S), sem credenciais"
                  name="url"
                  onChange={update}
                  required
                  type="url"
                  value={draft.url}
                />
                <SelectField
                  className="catalogRepositorySecondaryField"
                  label="Provedor"
                  name="provider"
                  onChange={update}
                  options={REPOSITORY_PROVIDERS}
                  required
                  value={draft.provider}
                />
                <TextField
                  className="catalogRepositorySecondaryField"
                  label="Branch padrão"
                  name="defaultBranch"
                  onChange={update}
                  value={draft.defaultBranch}
                />
                <TextField
                  className="catalogRepositorySecondaryField"
                  label="Organização"
                  name="organization"
                  onChange={update}
                  value={draft.organization}
                />
              </div>
            ) : null}

            {kind === "server" ? (
              <>
                <TextField
                  label="Hostname"
                  name="hostname"
                  onChange={update}
                  value={draft.hostname}
                />
                <TextField
                  label="Provedor"
                  name="provider"
                  onChange={update}
                  value={draft.provider}
                />
                <TextField
                  label="Localização"
                  name="location"
                  onChange={update}
                  value={draft.location}
                />
                <TextField
                  label="Sistema operacional"
                  name="operatingSystem"
                  onChange={update}
                  value={draft.operatingSystem}
                />
                <TextField
                  label="Finalidade"
                  name="purpose"
                  onChange={update}
                  value={draft.purpose}
                />
                <SelectField
                  label="Status"
                  name="status"
                  onChange={update}
                  options={SERVER_STATUSES}
                  required
                  value={draft.status}
                />
                <TextField
                  label="Tags, separadas por vírgula"
                  name="tagsText"
                  onChange={update}
                  value={draft.tagsText}
                />
                <label className="field catalogWideField">
                  <span>Endereços, um por linha</span>
                  <textarea
                    onChange={(event) =>
                      update("addressesText", event.target.value)
                    }
                    rows={3}
                    value={draft.addressesText}
                  />
                </label>
              </>
            ) : null}

            {kind === "deployment" && activeSection === "basic" ? (
              <>
                {!editing ? (
                  <SelectField
                    label="Componente"
                    name="componentId"
                    onChange={update}
                    options={(options.components || []).map(({ id, name }) => ({
                      value: id,
                      label: name,
                    }))}
                    required
                    value={draft.componentId}
                  />
                ) : null}
                <SelectField
                  label="Ambiente"
                  name="environment"
                  onChange={update}
                  options={ENVIRONMENTS}
                  required
                  value={draft.environment}
                />
                <SelectField
                  label="Repositório"
                  name="repositoryId"
                  onChange={update}
                  options={(options.repositories || []).map(({ id, name }) => ({
                    value: id,
                    label: name,
                  }))}
                  value={draft.repositoryId}
                />
                <SelectField
                  label="Status"
                  name="status"
                  onChange={update}
                  options={DEPLOYMENT_STATUSES}
                  required
                  value={draft.status}
                />
              </>
            ) : null}

            {kind === "deployment" && activeSection === "publications" ? (
              <div className="catalogHistorySection catalogWideField">
                <div className="catalogHistoryComposer">
                  <TextField
                    label="Versão"
                    name="publicationVersion"
                    onChange={(_name, value) =>
                      setPublicationDraft((current) => ({
                        ...current,
                        version: value,
                      }))
                    }
                    value={publicationDraft.version}
                  />
                  <TextField
                    label="Revisão"
                    name="publicationRevision"
                    onChange={(_name, value) =>
                      setPublicationDraft((current) => ({
                        ...current,
                        revision: value,
                      }))
                    }
                    value={publicationDraft.revision}
                  />
                  <TextField
                    label="Publicado em"
                    name="publicationDate"
                    onChange={(_name, value) =>
                      setPublicationDraft((current) => ({
                        ...current,
                        publishedAt: value,
                      }))
                    }
                    type="datetime-local"
                    value={publicationDraft.publishedAt}
                  />
                  <label className="field catalogHistoryDescription">
                    <span>Descrição da publicação</span>
                    <textarea
                      onChange={(event) =>
                        setPublicationDraft((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                      value={publicationDraft.description}
                    />
                  </label>
                  <button
                    className="secondaryButton"
                    disabled={!publicationDraft.version.trim()}
                    onClick={addPublication}
                    type="button"
                  >
                    Adicionar publicação
                  </button>
                </div>
                <HistoryItems
                  empty="Nenhuma publicação registrada."
                  items={[...(draft.publications || [])].reverse()}
                  renderItem={(publication) => (
                    <>
                      <strong>{publication.version}</strong>
                      <small>
                        {formatDate(publication.publishedAt)}
                        {publication.revision
                          ? ` · ${publication.revision}`
                          : ""}
                      </small>
                      {publication.description ? (
                        <p>{publication.description}</p>
                      ) : null}
                    </>
                  )}
                />
              </div>
            ) : null}

            {kind === "runtime" && activeSection === "basic" ? (
              <>
                <SelectField
                  label="Tipo"
                  name="kind"
                  onChange={update}
                  options={RUNTIME_KINDS}
                  required
                  value={draft.kind}
                />
                <SelectField
                  label="Servidor"
                  name="serverId"
                  onChange={update}
                  options={(options.servers || []).map(({ id, name }) => ({
                    value: id,
                    label: name,
                  }))}
                  value={draft.serverId}
                />
                <SelectField
                  label="Status"
                  name="status"
                  onChange={update}
                  options={RUNTIME_STATUSES}
                  required
                  value={draft.status}
                />
              </>
            ) : null}

            {kind === "runtime" && activeSection === "service" ? (
              <>
                <TextField
                  label="Endpoint"
                  name="endpoint"
                  onChange={update}
                  type="url"
                  value={draft.endpoint}
                />
                <TextField
                  label="Porta"
                  name="port"
                  onChange={update}
                  type="number"
                  value={draft.port}
                />
                <TextField
                  label="Namespace"
                  name="namespace"
                  onChange={update}
                  value={draft.namespace}
                />
                <TextField
                  label="Nome no runtime"
                  name="runtimeName"
                  onChange={update}
                  value={draft.runtimeName}
                />
                <label className="field catalogWideField">
                  <span>Metadata JSON sem segredos</span>
                  <textarea
                    onChange={(event) =>
                      update("metadataText", event.target.value)
                    }
                    rows={5}
                    value={draft.metadataText}
                  />
                </label>
              </>
            ) : null}

            {kind === "runtime" && activeSection === "monitoring" ? (
              <div className="catalogHistorySection catalogWideField">
                <div className="catalogHistoryComposer">
                  <SelectField
                    label="Saúde observada"
                    name="observationStatus"
                    onChange={(_name, value) =>
                      setObservationDraft((current) => ({
                        ...current,
                        healthStatus: value,
                      }))
                    }
                    options={RUNTIME_STATUSES}
                    value={observationDraft.healthStatus}
                  />
                  <TextField
                    label="Observado em"
                    name="observationDate"
                    onChange={(_name, value) =>
                      setObservationDraft((current) => ({
                        ...current,
                        observedAt: value,
                      }))
                    }
                    type="datetime-local"
                    value={observationDraft.observedAt}
                  />
                  <TextField
                    label="Origem"
                    name="observationSource"
                    onChange={(_name, value) =>
                      setObservationDraft((current) => ({
                        ...current,
                        source: value,
                      }))
                    }
                    placeholder="Ex.: Zabbix, Grafana, registro manual"
                    value={observationDraft.source}
                  />
                  <label className="field catalogHistoryDescription">
                    <span>Mensagem</span>
                    <textarea
                      onChange={(event) =>
                        setObservationDraft((current) => ({
                          ...current,
                          message: event.target.value,
                        }))
                      }
                      rows={3}
                      value={observationDraft.message}
                    />
                  </label>
                  <button
                    className="secondaryButton"
                    disabled={!observationDraft.observedAt}
                    onClick={addObservation}
                    type="button"
                  >
                    Adicionar observação
                  </button>
                </div>
                <HistoryItems
                  empty="Nenhuma observação registrada."
                  items={[...(draft.observations || [])].reverse()}
                  renderItem={(observation) => (
                    <>
                      <strong>{observation.healthStatus}</strong>
                      <small>
                        {formatDate(observation.observedAt)}
                        {observation.source ? ` · ${observation.source}` : ""}
                      </small>
                      {observation.message ? (
                        <p>{observation.message}</p>
                      ) : null}
                    </>
                  )}
                />
              </div>
            ) : null}

            {kind === "runtime" && activeSection === "procedure" ? (
              <label className="field catalogWideField catalogProcedureField">
                <span>Procedimento de publicação (Markdown)</span>
                <MarkdownEditor
                  onChange={(value) => update("procedureMarkdown", value)}
                  value={draft.procedureMarkdown || ""}
                />
              </label>
            ) : null}

            {[
              "application",
              "component",
              "integration",
              "repository",
              "server",
            ].includes(kind) ? (
              <label className="field catalogWideField">
                <span>Descrição</span>
                <textarea
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  rows={4}
                  value={draft.description || ""}
                />
              </label>
            ) : null}
          </div>
          {error ? <div className="errorBox">{error}</div> : null}
          <footer>
            <button
              className="secondaryButton"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button className="primaryButton" disabled={saving} type="submit">
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
