import { Eye, FolderTree, Save, X } from "lucide-react";
import { useEffect, useState } from "react";

import { MarkdownEditor } from "../shared/MarkdownEditor/index.jsx";
import { MonitoringEventDetails } from "../shared/MonitoringEventDetails.jsx";
import {
  createRuntimeManualMonitoringObservation,
  fetchProcedure,
  fetchRuntimeMonitoringTimeline,
} from "../../api.js";
import { buildUrl } from "../../api/client.js";
import {
  CATALOG_ENTITY_LABELS,
  catalogEntityDraft,
  catalogEntityPayload,
  monitoringSignalCurl,
  runtimeMonitoringPath,
} from "./catalogModel.js";
import { RuntimeProcedureSelectorDialog } from "./RuntimeProcedureSelectorDialog.jsx";
import { RuntimeProcedureDetailsDialog } from "./RuntimeProcedureDetailsDialog.jsx";

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
  const [monitoringEvents, setMonitoringEvents] = useState([]);
  const [monitoringError, setMonitoringError] = useState("");
  const [addingObservation, setAddingObservation] = useState(false);
  const [procedureSelectorOpen, setProcedureSelectorOpen] = useState(false);
  const [relatedProcedures, setRelatedProcedures] = useState([]);
  const [relatedProceduresLoading, setRelatedProceduresLoading] =
    useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState(null);
  const label = CATALOG_ENTITY_LABELS[kind];
  const runtimeDeployment = (options.deployments || []).find(
    ({ id }) => id === entity?.deploymentId,
  );
  const runtimeComponent = (options.components || []).find(
    ({ id }) => id === (entity?.componentId || runtimeDeployment?.componentId),
  );
  const runtimePath = runtimeMonitoringPath({
    application: options.application,
    component: runtimeComponent,
    deployment: runtimeDeployment,
    runtime: entity,
  });
  const monitoringUrl = runtimePath
    ? buildUrl(
        `/api/monitoring/runtimes/${encodeURIComponent(runtimePath)}/signals`,
      ).toString()
    : "";
  const curlExample = monitoringSignalCurl({
    apiUrl: monitoringUrl,
    runtimeReference: runtimePath,
    workspaceId: options.workspace?.id,
  });
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

  useEffect(() => {
    if (kind !== "runtime" || !entity?.id) return;
    let active = true;
    fetchRuntimeMonitoringTimeline(entity.id, { limit: 100 })
      .then((payload) => {
        if (active) setMonitoringEvents(payload.items || []);
      })
      .catch((loadError) => {
        if (active) setMonitoringError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, [entity?.id, kind]);

  const relatedProcedureIds = (draft.procedureIds || []).join(",");
  useEffect(() => {
    if (kind !== "runtime" || !options.canReadProcedures) return;
    const procedureIds = relatedProcedureIds.split(",").filter(Boolean);
    if (!procedureIds.length) {
      setRelatedProcedures([]);
      setRelatedProceduresLoading(false);
      return;
    }
    let active = true;
    setRelatedProceduresLoading(true);
    Promise.allSettled(procedureIds.map((id) => fetchProcedure(id)))
      .then((results) => {
        if (!active) return;
        setRelatedProcedures(
          results.map((result, index) =>
            result.status === "fulfilled"
              ? result.value.procedure
              : {
                  id: procedureIds[index],
                  title: procedureIds[index],
                  loadError: result.reason?.message || "Falha ao carregar",
                },
          ),
        );
      })
      .finally(() => {
        if (active) setRelatedProceduresLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, options.canReadProcedures, relatedProcedureIds]);

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

  async function addObservation() {
    if (!entity?.id || !observationDraft.observedAt) return;
    setAddingObservation(true);
    setMonitoringError("");
    try {
      const result = await createRuntimeManualMonitoringObservation(entity.id, {
        status: observationDraft.healthStatus,
        observedAt: new Date(observationDraft.observedAt).toISOString(),
        source: observationDraft.source.trim(),
        message: observationDraft.message.trim(),
        metadata: {},
      });
      setMonitoringEvents((current) =>
        [result.signal, ...current].sort(
          (left, right) =>
            new Date(right.observedAt) - new Date(left.observedAt),
        ),
      );
      setObservationDraft({
        healthStatus: "unknown",
        observedAt: "",
        source: "",
        message: "",
      });
    } catch (addError) {
      setMonitoringError(addError.message);
    } finally {
      setAddingObservation(false);
    }
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
            {!sections.length || activeSection === "basic" ? (
              <TextField
                label="Identificador"
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
                <div className="catalogMonitoringSummary">
                  <strong>Linha do tempo de monitoramento</strong>
                  <span>
                    Sinais externos e observações manuais aparecem juntos, com a
                    origem identificada em cada registro.
                  </span>
                  {entity?.monitoring ? (
                    <small>
                      Último sinal externo: {entity.monitoring.status} ·{" "}
                      {formatDate(entity.monitoring.observedAt)} ·{" "}
                      {entity.monitoring.source}
                    </small>
                  ) : (
                    <small>Nenhum sinal externo recebido.</small>
                  )}
                </div>
                <div className="catalogMonitoringInstructions">
                  <h3>Referência do runtime</h3>
                  <p>
                    Envie sinais usando o UUID ou o caminho formado pelos
                    identificadores da aplicação, componente, deployment e
                    runtime. O UUID não muda; o caminho acompanha edições nos
                    identificadores.
                  </p>
                  <dl>
                    <div>
                      <dt>Workspace</dt>
                      <dd>
                        <code>{options.workspace?.id}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>UUID</dt>
                      <dd>
                        <code>{entity?.id}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>Caminho</dt>
                      <dd>
                        <code>{runtimePath || "Caminho indisponível"}</code>
                      </dd>
                    </div>
                  </dl>
                  {curlExample ? (
                    <>
                      <h3>Exemplo com curl</h3>
                      <pre>
                        <code>{curlExample}</code>
                      </pre>
                    </>
                  ) : null}
                </div>
                {monitoringError ? (
                  <div className="errorBox">{monitoringError}</div>
                ) : null}
                <label className="field catalogMonitoringRetention">
                  <span>Retenção do histórico (dias)</span>
                  <input
                    max="3650"
                    min="0"
                    onChange={(event) =>
                      update("monitoringRetentionDays", event.target.value)
                    }
                    type="number"
                    value={draft.monitoringRetentionDays}
                  />
                  <small>
                    Padrão: 10 dias. Use 0 para manter o histórico sem
                    expiração.
                  </small>
                </label>
                <h3 className="catalogMonitoringManualTitle">
                  Adicionar observação manual
                </h3>
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
                    disabled={
                      !editing ||
                      !observationDraft.observedAt ||
                      addingObservation
                    }
                    onClick={addObservation}
                    type="button"
                  >
                    {addingObservation
                      ? "Registrando..."
                      : "Adicionar observação"}
                  </button>
                </div>
                {!editing ? (
                  <small>Salve o runtime antes de registrar observações.</small>
                ) : null}
                <HistoryItems
                  empty="Nenhum registro de monitoramento recebido."
                  items={monitoringEvents}
                  renderItem={(event) => (
                    <>
                      <div className="catalogMonitoringEventHeading">
                        <strong>{event.status}</strong>
                        <span className="monitoringOriginBadge">
                          {event.origin === "manual" ? "Manual" : "Externo"}
                        </span>
                      </div>
                      <small>
                        {formatDate(event.observedAt)}
                        {event.source ? ` · ${event.source}` : ""}
                      </small>
                      {event.message ? <p>{event.message}</p> : null}
                      <MonitoringEventDetails event={event} />
                    </>
                  )}
                />
              </div>
            ) : null}

            {kind === "runtime" && activeSection === "procedure" ? (
              <>
                {options.canReadProcedures ? (
                  <div className="catalogWideField runtimeProcedureSection">
                    <div className="runtimeProcedureSelectionField">
                      <div>
                        <strong>Procedimentos relacionados</strong>
                        <span>
                          {(draft.procedureIds || []).length
                            ? `${draft.procedureIds.length} procedimento(s) selecionado(s)`
                            : "Nenhum procedimento selecionado"}
                        </span>
                      </div>
                      <button
                        className="secondaryButton"
                        onClick={() => setProcedureSelectorOpen(true)}
                        type="button"
                      >
                        <FolderTree size={16} /> Selecionar procedimentos
                      </button>
                    </div>
                    {relatedProceduresLoading ? (
                      <div className="catalogColumnEmpty">Carregando…</div>
                    ) : null}
                    {!relatedProceduresLoading && relatedProcedures.length ? (
                      <div className="runtimeRelatedProcedureList">
                        {relatedProcedures.map((procedure) => (
                          <article key={procedure.id}>
                            <div>
                              <strong>{procedure.title}</strong>
                              <span>
                                {procedure.loadError
                                  ? procedure.loadError
                                  : procedure.summary || "Sem sumário"}
                              </span>
                            </div>
                            <button
                              className="secondaryButton"
                              disabled={Boolean(procedure.loadError)}
                              onClick={() => setSelectedProcedure(procedure)}
                              type="button"
                            >
                              <Eye size={16} /> Abrir dados
                            </button>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <label className="field catalogWideField catalogProcedureField">
                  <span>Instruções complementares (Markdown)</span>
                  <MarkdownEditor
                    onChange={(value) => update("procedureMarkdown", value)}
                    value={draft.procedureMarkdown || ""}
                  />
                  <small>
                    Use este campo para instruções específicas deste runtime ou
                    quando não quiser vincular um procedimento existente.
                  </small>
                </label>
              </>
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
      {procedureSelectorOpen ? (
        <RuntimeProcedureSelectorDialog
          applicationId={options.application?.id}
          componentId={runtimeComponent?.id}
          onClose={() => setProcedureSelectorOpen(false)}
          onConfirm={(procedureIds) => {
            update("procedureIds", procedureIds);
            setProcedureSelectorOpen(false);
          }}
          selectedIds={draft.procedureIds || []}
        />
      ) : null}
      {selectedProcedure ? (
        <RuntimeProcedureDetailsDialog
          application={options.application}
          applications={options.applications}
          components={options.components}
          onClose={() => setSelectedProcedure(null)}
          procedure={selectedProcedure}
        />
      ) : null}
    </div>
  );
}
