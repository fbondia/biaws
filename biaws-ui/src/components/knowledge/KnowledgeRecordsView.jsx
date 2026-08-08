import {
  Archive,
  BookMarked,
  BookOpen,
  Boxes,
  Eye,
  FileText,
  GitBranch,
  GripVertical,
  Plus,
  Save,
  Scale,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  addDocumentObservation,
  archiveDocument,
  createDocument,
  fetchDocument,
  fetchDocumentObservations,
  fetchDocumentRevisions,
  fetchDocuments,
  moveDocumentToCollection,
  saveDocument,
} from "../../api.js";
import { hasPermission } from "../../permissions.js";
import {
  CatalogContextFields,
  CatalogFilterFields,
  useCatalogOptions,
} from "../catalog/CatalogContextFields.jsx";
import { AuditHistory } from "../shared/AuditHistory.jsx";
import { IllustratedEmptyState } from "../shared/IllustratedEmptyState.jsx";
import {
  MarkdownEditor,
  MarkdownPreview,
} from "../shared/MarkdownEditor/index.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionNavigator,
  ResourceCollectionSearch,
  ResourceCollectionsShell,
} from "../shared/ResourceCollections/index.jsx";
import { useResourceCollections } from "../shared/useResourceCollections.js";

const DOCUMENT_TYPES = Object.freeze({
  "business-rule": {
    label: "Regra de negócio",
    plural: "Regras de negócio",
    icon: Scale,
    statuses: [
      ["draft", "Rascunho"],
      ["active", "Ativa"],
      ["retired", "Retirada"],
    ],
    defaultStatus: "draft",
    details: { ruleCode: "", effectiveFrom: "" },
    template:
      "## Regra\n\n## Motivação\n\n## Cenários e exceções\n\n## Critérios de validação\n",
  },
  "architecture-decision": {
    label: "Decisão arquitetural",
    plural: "Decisões arquiteturais",
    icon: GitBranch,
    statuses: [
      ["proposed", "Proposta"],
      ["accepted", "Aceita"],
      ["rejected", "Rejeitada"],
      ["superseded", "Substituída"],
    ],
    defaultStatus: "proposed",
    details: { decidedAt: "" },
    template:
      "## Contexto\n\n## Decisão\n\n## Alternativas consideradas\n\n## Consequências\n",
  },
  guideline: {
    label: "Guideline",
    plural: "Guidelines",
    icon: BookOpen,
    statuses: [
      ["draft", "Rascunho"],
      ["published", "Publicada"],
      ["deprecated", "Descontinuada"],
    ],
    defaultStatus: "draft",
    details: { scope: "workspace", enforcement: "recommended" },
    template:
      "## Objetivo\n\n## Diretriz\n\n## Motivação\n\n## Exemplos recomendados\n\n## Antipadrões\n\n## Exceções\n\n## Verificação\n",
  },
  feature: {
    label: "Feature",
    plural: "Features",
    icon: Boxes,
    statuses: [
      ["draft", "Rascunho"],
      ["published", "Publicada"],
      ["deprecated", "Descontinuada"],
    ],
    defaultStatus: "draft",
    details: { maturity: "stable" },
    template:
      "## Propósito e atores\n\n## Capacidades e fluxos\n\n## Regras relacionadas\n\n## Visão técnica\n\n## Dados e contratos\n\n## Permissões\n\n## Casos-limite\n\n## Observabilidade e testes\n",
  },
  "technical-reference": {
    label: "Referência técnica",
    plural: "Referências técnicas",
    icon: FileText,
    statuses: [
      ["draft", "Rascunho"],
      ["published", "Publicada"],
      ["deprecated", "Descontinuada"],
    ],
    defaultStatus: "draft",
    details: { referenceKind: "architecture" },
    template:
      "## Objetivo\n\n## Desenho atual\n\n## Interfaces e modelo de dados\n\n## Invariantes\n\n## Modos de falha\n\n## Considerações operacionais\n",
  },
});

const TYPE_FILTERS = [
  ["", "Todos", BookMarked],
  ...Object.entries(DOCUMENT_TYPES).map(([type, config]) => [
    type,
    config.plural,
    config.icon,
  ]),
];

const TABS = [
  ["content", "Conteúdo"],
  ["type", "Tipo"],
  ["context", "Contexto"],
  ["references", "Referências"],
  ["observations", "Observações"],
  ["revisions", "Revisões"],
  ["history", "Histórico"],
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(documentType, collectionId = "") {
  const config = DOCUMENT_TYPES[documentType];
  return {
    id: "",
    documentType,
    title: "",
    summary: "",
    markdown: config.template,
    applicationId: "",
    affectedComponentIds: [],
    collectionId,
    status: config.defaultStatus,
    details: { ...config.details },
    source: { mode: "native", repositoryId: "", path: "" },
    references: [],
    definedAt: today(),
    lastReviewedAt: "",
    nextReviewAt: "",
  };
}

function normalizedDraft(record = {}) {
  const documentType = record.documentType || "business-rule";
  return {
    ...emptyDraft(documentType),
    ...record,
    details: {
      ...DOCUMENT_TYPES[documentType].details,
      ...(record.details || {}),
    },
    source: {
      mode: "native",
      repositoryId: "",
      path: "",
      ...(record.source || {}),
    },
    affectedComponentIds: record.affectedComponentIds || [],
    references: record.references || [],
  };
}

function statusLabel(document) {
  return (
    DOCUMENT_TYPES[document.documentType]?.statuses.find(
      ([value]) => value === document.status,
    )?.[1] || document.status
  );
}

export function KnowledgeRecordsView({ actor }) {
  const canCreate = hasPermission(actor, "documents.create");
  const canUpdate = hasPermission(actor, "documents.update");
  const canArchive = hasPermission(actor, "documents.archive");
  const catalog = useCatalogOptions(
    hasPermission(actor, "applications.read") &&
      hasPermission(actor, "components.read"),
    actor.workspaceId,
  );
  const [items, setItems] = useState([]);
  const [organizationItems, setOrganizationItems] = useState([]);
  const [draft, setDraft] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [createType, setCreateType] = useState("business-rule");
  const [search, setSearch] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [componentFilter, setComponentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const collectionsState = useResourceCollections("documents", {
    onError: setError,
    onMoved: () => load(),
  });

  async function load(
    searchValue = search,
    applicationValue = applicationFilter,
    componentValue = componentFilter,
    typeValue = typeFilter,
  ) {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchDocuments({
        search: searchValue,
        documentType: typeValue,
        applicationId: applicationValue,
        componentId: componentValue,
        limit: 100,
      });
      const loaded = payload.items || [];
      setItems(loaded);
      const filtered = Boolean(
        searchValue || applicationValue || componentValue,
      );
      if (!filtered) setOrganizationItems(loaded);
      setSearchActive(filtered);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load("", "", "", typeFilter);
  }, [typeFilter]);

  async function openRecord(record) {
    setError("");
    try {
      const payload = await fetchDocument(record.id);
      setDraft(normalizedDraft(payload.document));
      collectionsState.setSelectedCollectionId(record.collectionId || "");
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function persist(nextDraft = draft) {
    setSaving(true);
    setError("");
    try {
      const payload = nextDraft.id
        ? await saveDocument(nextDraft.id, nextDraft)
        : await createDocument(nextDraft);
      setDraft(normalizedDraft(payload.document));
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function archive(record) {
    if (!window.confirm(`Arquivar “${record.title}”?`)) return;
    try {
      await archiveDocument(record.id);
      if (draft?.id === record.id) setDraft(null);
      await load();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  async function moveItem(id, collectionId) {
    await moveDocumentToCollection(id, collectionId);
    setOrganizationItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, collectionId } : item,
      ),
    );
  }

  const visibleItems = searchActive
    ? items
    : items.filter(
        (item) =>
          (item.collectionId || "") === collectionsState.selectedCollectionId,
      );

  return (
    <section className="proceduresView contentBand knowledgeRecordsView">
      <div className="documentTypeSelector" aria-label="Tipo de documento">
        {TYPE_FILTERS.map(([value, label, Icon]) => (
          <button
            aria-pressed={typeFilter === value}
            className={
              typeFilter === value
                ? "documentTypeOption active"
                : "documentTypeOption"
            }
            key={value || "all"}
            onClick={() => {
              setDraft(null);
              setTypeFilter(value);
              if (value) setCreateType(value);
            }}
            type="button"
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>
      <div className="proceduresToolbar documentCreateToolbar">
        <div />
        {canCreate ? (
          <div className="documentCreateActions">
            <select
              aria-label="Tipo do novo documento"
              onChange={(event) => setCreateType(event.target.value)}
              value={createType}
            >
              {Object.entries(DOCUMENT_TYPES).map(([value, config]) => (
                <option key={value} value={value}>
                  {config.label}
                </option>
              ))}
            </select>
            <button
              className="primaryButton"
              onClick={() =>
                setDraft(
                  emptyDraft(
                    createType,
                    searchActive ? "" : collectionsState.selectedCollectionId,
                  ),
                )
              }
              type="button"
            >
              <Plus size={16} /> Novo documento
            </button>
          </div>
        ) : null}
      </div>
      <div className="procedureFiltersBox">
        <div className="procedureFiltersForm">
          {catalog.applications.length ? (
            <CatalogFilterFields
              applicationId={applicationFilter}
              applications={catalog.applications}
              componentId={componentFilter}
              components={catalog.components}
              onChange={(field, value) => {
                if (field === "applicationId") setApplicationFilter(value);
                if (field === "componentId") setComponentFilter(value);
              }}
            />
          ) : null}
          <button
            className="secondaryButton"
            onClick={() => load()}
            type="button"
          >
            Filtrar
          </button>
        </div>
      </div>
      {error ? <div className="errorBox">{error}</div> : null}
      <ResourceCollectionsShell
        collections={collectionsState.collections}
        detailVisible={Boolean(draft)}
        draggedItem={collectionsState.draggedItem}
        onDropRoot={() => collectionsState.dropItem("", moveItem)}
        onNavigateBack={() => setDraft(null)}
        onSelectCollection={collectionsState.setSelectedCollectionId}
        pathLabel={
          draft
            ? `${collectionPathLabel(collectionsState.collections, draft.collectionId)} / ${draft.title || `Novo ${DOCUMENT_TYPES[draft.documentType].label.toLocaleLowerCase("pt-BR")}`}`
            : searchActive
              ? "Resultados da busca"
              : undefined
        }
        selectedCollectionId={collectionsState.selectedCollectionId}
        navigator={
          <ResourceCollectionNavigator
            canDragItem={() => canUpdate}
            collections={collectionsState.collections}
            draggedItem={collectionsState.draggedItem}
            itemLabel="documentos"
            items={organizationItems}
            onCreate={collectionsState.createCollection}
            onDelete={collectionsState.removeCollection}
            onDeleteItem={canArchive ? archive : undefined}
            onDragCollection={(collection) =>
              collectionsState.setDraggedItem({
                type: "collection",
                id: collection.id,
                parentId: collection.parentId || "",
              })
            }
            onDragEnd={() => collectionsState.setDraggedItem(null)}
            onDragItem={(record) =>
              collectionsState.setDraggedItem({
                type: "record",
                id: record.id,
                collectionId: record.collectionId || "",
              })
            }
            onDrop={(collectionId) =>
              collectionsState.dropItem(collectionId, moveItem)
            }
            onRename={collectionsState.setCollectionDialog}
            onSelect={(collectionId) => {
              setDraft(null);
              collectionsState.setSelectedCollectionId(collectionId);
            }}
            onSelectItem={openRecord}
            renderItem={(record) => {
              const TypeIcon =
                DOCUMENT_TYPES[record.documentType]?.icon || FileText;
              return (
                <>
                  <TypeIcon size={13} /> <span>{record.title}</span>
                </>
              );
            }}
            selectedCollectionId={collectionsState.selectedCollectionId}
            selectedItemId={draft?.id}
          />
        }
        toolbar={
          draft ? null : (
            <ResourceCollectionSearch
              loading={loading}
              onRefresh={() => load()}
              onSearch={() => load()}
              onSearchChange={setSearch}
              placeholder="Buscar documentos"
              search={search}
            />
          )
        }
      >
        {draft ? (
          <DocumentDetail
            canArchive={canArchive}
            canUpdate={canUpdate || (!draft.id && canCreate)}
            catalog={catalog}
            draft={draft}
            onArchive={() => archive(draft)}
            onChange={setDraft}
            onSave={persist}
            saving={saving}
          />
        ) : (
          <section className="resourceCollectionContent">
            {loading ? (
              <div className="loadingLine">Carregando documentos...</div>
            ) : null}
            {!loading && !visibleItems.length ? (
              <IllustratedEmptyState
                description="Crie o primeiro documento para registrar conhecimento governado do workspace."
                icon={BookMarked}
                title="Nenhum documento encontrado"
              />
            ) : null}
            <div className="procedureCards">
              {visibleItems.map((record) => {
                const config = DOCUMENT_TYPES[record.documentType];
                const TypeIcon = config?.icon || FileText;
                return (
                  <article
                    className="procedureCard draggableProcedureCard"
                    key={record.id}
                  >
                    <header>
                      <div>
                        <GripVertical size={15} />
                        <TypeIcon size={18} />
                        <h2>{record.title}</h2>
                      </div>
                      <div>
                        <button
                          className="iconButton"
                          onClick={() => openRecord(record)}
                          title="Visualizar"
                          type="button"
                        >
                          <Eye size={16} />
                        </button>
                        {canArchive ? (
                          <button
                            className="iconButton dangerIconButton"
                            onClick={() => archive(record)}
                            title="Arquivar"
                            type="button"
                          >
                            <Archive size={16} />
                          </button>
                        ) : null}
                      </div>
                    </header>
                    <span
                      className={`documentTypeBadge documentType-${record.documentType}`}
                    >
                      {config?.label || record.documentType}
                    </span>
                    <p>{record.summary}</p>
                    <p className="procedureCardSummary">
                      {statusLabel(record)} · definida em{" "}
                      {record.definedAt || "data não informada"}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </ResourceCollectionsShell>
      {collectionsState.collectionDialog ? (
        <ResourceCollectionDialog
          collection={collectionsState.collectionDialog}
          onClose={() => collectionsState.setCollectionDialog(null)}
          onSave={async (name) => {
            await collectionsState.saveCollection(name);
            collectionsState.setCollectionDialog(null);
          }}
          resourceLabel="documentos"
        />
      ) : null}
    </section>
  );
}

function DocumentDetail({
  canArchive,
  canUpdate,
  catalog,
  draft,
  onArchive,
  onChange,
  onSave,
  saving,
}) {
  const config = DOCUMENT_TYPES[draft.documentType];
  const [tab, setTab] = useState("content");
  const [observations, setObservations] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [observationDraft, setObservationDraft] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [referenceOptions, setReferenceOptions] = useState([]);

  useEffect(() => {
    if (!draft.id) return;
    Promise.all([
      fetchDocumentObservations(draft.id),
      fetchDocumentRevisions(draft.id),
    ]).then(([observationPayload, revisionPayload]) => {
      setObservations(observationPayload.items || []);
      setRevisions(revisionPayload.items || []);
    });
  }, [draft.id, refreshKey]);

  useEffect(() => {
    fetchDocuments({ limit: 100 })
      .then((payload) =>
        setReferenceOptions(
          (payload.items || []).filter(({ id }) => id !== draft.id),
        ),
      )
      .catch(() => setReferenceOptions([]));
  }, [draft.id]);

  function changeType(documentType) {
    const next = DOCUMENT_TYPES[documentType];
    onChange({
      ...draft,
      documentType,
      status: next.defaultStatus,
      details: { ...next.details },
      markdown:
        draft.markdown === config.template ? next.template : draft.markdown,
    });
  }

  function changeContext(context) {
    if (draft.documentType !== "guideline") {
      onChange({ ...draft, ...context });
      return;
    }
    const scope = !context.applicationId
      ? "workspace"
      : context.affectedComponentIds?.length
        ? "component"
        : draft.details.scope === "workspace"
          ? "application"
          : draft.details.scope;
    onChange({
      ...draft,
      ...context,
      details: { ...draft.details, scope },
    });
  }

  return (
    <section className="resourceCollectionContent knowledgeRecordDetail">
      <header className="knowledgeRecordHeader">
        <div className="knowledgeRecordTitle">
          <BookMarked size={20} />
          <div>
            <span
              className={`documentTypeBadge documentType-${draft.documentType}`}
            >
              {config.label}
            </span>
            <h2>{draft.title || config.label}</h2>
          </div>
        </div>
        <div className="knowledgeRecordActions">
          {draft.id && canArchive ? (
            <button
              className="secondaryButton"
              onClick={onArchive}
              type="button"
            >
              <Archive size={16} /> Arquivar
            </button>
          ) : null}
          {canUpdate ? (
            <button
              className="primaryButton"
              disabled={saving}
              onClick={() => onSave()}
              type="button"
            >
              <Save size={16} /> {saving ? "Salvando..." : "Salvar"}
            </button>
          ) : null}
        </div>
      </header>
      <nav
        className="detailTabs knowledgeRecordTabs"
        aria-label="Detalhes do documento"
      >
        {TABS.filter(
          ([key]) =>
            draft.id || !["observations", "revisions", "history"].includes(key),
        ).map(([key, label]) => (
          <button
            className={tab === key ? "detailTab activeDetailTab" : "detailTab"}
            key={key}
            onClick={() => setTab(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "content" ? (
        <div className="dialogForm knowledgeRecordPanel">
          <label className="field">
            <span>Título</span>
            <input
              disabled={!canUpdate}
              maxLength={240}
              onChange={(event) =>
                onChange({ ...draft, title: event.target.value })
              }
              value={draft.title}
            />
          </label>
          <label className="field">
            <span>Resumo</span>
            <textarea
              disabled={!canUpdate}
              maxLength={500}
              onChange={(event) =>
                onChange({ ...draft, summary: event.target.value })
              }
              rows={3}
              value={draft.summary}
            />
          </label>
          <label className="field">
            <span>Estado</span>
            <select
              disabled={!canUpdate}
              onChange={(event) =>
                onChange({ ...draft, status: event.target.value })
              }
              value={draft.status}
            >
              {config.statuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span>Conteúdo Markdown</span>
            <MarkdownEditor
              onChange={(markdown) => onChange({ ...draft, markdown })}
              value={draft.markdown}
            />
          </div>
        </div>
      ) : null}
      {tab === "type" ? (
        <div className="dialogForm knowledgeRecordPanel">
          <label className="field">
            <span>Tipo de documento</span>
            <select
              disabled={!canUpdate || Boolean(draft.id)}
              onChange={(event) => changeType(event.target.value)}
              value={draft.documentType}
            >
              {Object.entries(DOCUMENT_TYPES).map(([value, typeConfig]) => (
                <option key={value} value={value}>
                  {typeConfig.label}
                </option>
              ))}
            </select>
          </label>
          {draft.id ? (
            <small>O tipo é imutável depois que o documento é criado.</small>
          ) : null}
          <DocumentDetailsFields
            disabled={!canUpdate}
            draft={draft}
            onChange={onChange}
          />
        </div>
      ) : null}
      {tab === "context" ? (
        <div className="dialogForm knowledgeRecordPanel">
          <CatalogContextFields
            affectedComponentIds={draft.affectedComponentIds}
            applicationId={draft.applicationId || ""}
            applications={catalog.applications}
            components={catalog.components}
            disabled={!canUpdate}
            onChange={changeContext}
            optional={["guideline", "technical-reference"].includes(
              draft.documentType,
            )}
          />
          <div className="formGrid">
            <label className="field">
              <span>Data de definição</span>
              <input
                disabled={!canUpdate}
                onChange={(event) =>
                  onChange({ ...draft, definedAt: event.target.value })
                }
                type="date"
                value={draft.definedAt}
              />
            </label>
            <label className="field">
              <span>Última revisão</span>
              <input
                disabled={!canUpdate}
                onChange={(event) =>
                  onChange({ ...draft, lastReviewedAt: event.target.value })
                }
                type="date"
                value={draft.lastReviewedAt}
              />
            </label>
            <label className="field">
              <span>Próxima revisão</span>
              <input
                disabled={!canUpdate}
                onChange={(event) =>
                  onChange({ ...draft, nextReviewAt: event.target.value })
                }
                type="date"
                value={draft.nextReviewAt}
              />
            </label>
          </div>
          <label className="field">
            <span>Origem</span>
            <select
              disabled={!canUpdate}
              onChange={(event) =>
                onChange({
                  ...draft,
                  source: { ...draft.source, mode: event.target.value },
                })
              }
              value={draft.source.mode}
            >
              <option value="native">Conteúdo nativo no Biaws</option>
              <option value="repository">Documento em repositório</option>
            </select>
          </label>
          {draft.source.mode === "repository" ? (
            <div className="formGrid">
              <label className="field">
                <span>ID do repositório</span>
                <input
                  disabled={!canUpdate}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      source: {
                        ...draft.source,
                        repositoryId: event.target.value,
                      },
                    })
                  }
                  value={draft.source.repositoryId}
                />
              </label>
              <label className="field">
                <span>Caminho do arquivo</span>
                <input
                  disabled={!canUpdate}
                  onChange={(event) =>
                    onChange({
                      ...draft,
                      source: { ...draft.source, path: event.target.value },
                    })
                  }
                  value={draft.source.path}
                />
              </label>
            </div>
          ) : null}
          {draft.id && canUpdate ? (
            <button
              className="secondaryButton"
              onClick={() =>
                onSave({
                  ...draft,
                  lastReviewedAt: today(),
                  changeSummary: "Conteúdo revisado",
                })
              }
              type="button"
            >
              Marcar como revisado hoje
            </button>
          ) : null}
        </div>
      ) : null}
      {tab === "references" ? (
        <ReferencesEditor
          disabled={!canUpdate}
          draft={draft}
          onChange={onChange}
          options={referenceOptions}
        />
      ) : null}
      {tab === "observations" ? (
        <div className="dialogForm knowledgeRecordPanel">
          {canUpdate ? (
            <>
              <div className="field">
                <span>Nova observação</span>
                <MarkdownEditor
                  onChange={setObservationDraft}
                  value={observationDraft}
                />
              </div>
              <button
                className="primaryButton"
                disabled={!observationDraft.trim()}
                onClick={async () => {
                  await addDocumentObservation(draft.id, observationDraft);
                  setObservationDraft("");
                  setRefreshKey((value) => value + 1);
                }}
                type="button"
              >
                Adicionar observação
              </button>
            </>
          ) : null}
          {observations.map((observation) => (
            <article className="auditEventContent" key={observation.id}>
              <small>
                {new Date(observation.createdAt).toLocaleString("pt-BR")} ·{" "}
                {observation.createdBy}
              </small>
              <MarkdownPreview value={observation.markdown} />
            </article>
          ))}
        </div>
      ) : null}
      {tab === "revisions" ? (
        <div className="dialogForm knowledgeRecordPanel">
          {revisions.map((revision) => (
            <article className="auditEventContent" key={revision.id}>
              <strong>Revisão {revision.revision}</strong>
              <small>
                {new Date(revision.createdAt).toLocaleString("pt-BR")} ·{" "}
                {revision.createdBy}
              </small>
              <p>{revision.summary}</p>
            </article>
          ))}
        </div>
      ) : null}
      {tab === "history" ? (
        <div className="knowledgeRecordHistory">
          <AuditHistory
            entityId={draft.id}
            entityType="document"
            refreshKey={refreshKey}
          />
        </div>
      ) : null}
    </section>
  );
}

function updateDetails(draft, onChange, field, value) {
  onChange({ ...draft, details: { ...draft.details, [field]: value } });
}

function DocumentDetailsFields({ disabled, draft, onChange }) {
  if (draft.documentType === "business-rule")
    return (
      <div className="formGrid">
        <label className="field">
          <span>Código da regra</span>
          <input
            disabled={disabled}
            onChange={(event) =>
              updateDetails(draft, onChange, "ruleCode", event.target.value)
            }
            value={draft.details.ruleCode}
          />
        </label>
        <label className="field">
          <span>Vigente desde</span>
          <input
            disabled={disabled}
            onChange={(event) =>
              updateDetails(
                draft,
                onChange,
                "effectiveFrom",
                event.target.value,
              )
            }
            type="date"
            value={draft.details.effectiveFrom}
          />
        </label>
      </div>
    );
  if (draft.documentType === "architecture-decision")
    return (
      <label className="field">
        <span>Data da decisão</span>
        <input
          disabled={disabled}
          onChange={(event) =>
            updateDetails(draft, onChange, "decidedAt", event.target.value)
          }
          type="date"
          value={draft.details.decidedAt}
        />
      </label>
    );
  if (draft.documentType === "guideline")
    return (
      <div className="formGrid">
        <label className="field">
          <span>Escopo da diretriz</span>
          <select
            disabled={disabled}
            onChange={(event) =>
              updateDetails(draft, onChange, "scope", event.target.value)
            }
            value={draft.details.scope}
          >
            <option value="workspace">Workspace</option>
            <option value="application">Aplicação</option>
            <option value="component">Componente</option>
          </select>
        </label>
        <label className="field">
          <span>Força</span>
          <select
            disabled={disabled}
            onChange={(event) =>
              updateDetails(draft, onChange, "enforcement", event.target.value)
            }
            value={draft.details.enforcement}
          >
            <option value="required">Obrigatória</option>
            <option value="recommended">Recomendada</option>
            <option value="informative">Informativa</option>
          </select>
        </label>
      </div>
    );
  if (draft.documentType === "feature")
    return (
      <label className="field">
        <span>Maturidade</span>
        <select
          disabled={disabled}
          onChange={(event) =>
            updateDetails(draft, onChange, "maturity", event.target.value)
          }
          value={draft.details.maturity}
        >
          <option value="planned">Planejada</option>
          <option value="beta">Beta</option>
          <option value="stable">Estável</option>
          <option value="retired">Retirada</option>
        </select>
      </label>
    );
  return (
    <label className="field">
      <span>Natureza da referência</span>
      <select
        disabled={disabled}
        onChange={(event) =>
          updateDetails(draft, onChange, "referenceKind", event.target.value)
        }
        value={draft.details.referenceKind}
      >
        <option value="architecture">Arquitetura</option>
        <option value="contract">Contrato</option>
        <option value="schema">Schema</option>
        <option value="protocol">Protocolo</option>
        <option value="mechanism">Mecanismo</option>
      </select>
    </label>
  );
}

function ReferencesEditor({ disabled, draft, onChange, options }) {
  function update(index, field, value) {
    onChange({
      ...draft,
      references: draft.references.map((reference, itemIndex) =>
        itemIndex === index ? { ...reference, [field]: value } : reference,
      ),
    });
  }
  return (
    <div className="dialogForm knowledgeRecordPanel">
      {draft.references.map((reference, index) => (
        <div className="formGrid" key={index}>
          <label className="field">
            <span>Documento referenciado</span>
            <select
              disabled={disabled}
              onChange={(event) =>
                update(index, "targetDocumentId", event.target.value)
              }
              value={reference.targetDocumentId}
            >
              <option value="">Selecione...</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {DOCUMENT_TYPES[option.documentType]?.label}: {option.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Relação</span>
            <input
              disabled={disabled}
              onChange={(event) =>
                update(index, "relationship", event.target.value)
              }
              value={reference.relationship}
            />
          </label>
          {!disabled ? (
            <button
              className="secondaryButton"
              onClick={() =>
                onChange({
                  ...draft,
                  references: draft.references.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
              type="button"
            >
              Remover
            </button>
          ) : null}
        </div>
      ))}
      {!disabled ? (
        <button
          className="secondaryButton"
          onClick={() =>
            onChange({
              ...draft,
              references: [
                ...draft.references,
                { targetDocumentId: "", relationship: "related" },
              ],
            })
          }
          type="button"
        >
          <Plus size={16} /> Adicionar referência
        </button>
      ) : null}
    </div>
  );
}
