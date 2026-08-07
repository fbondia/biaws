import {
  Archive,
  BookMarked,
  Eye,
  GitBranch,
  GripVertical,
  Plus,
  Save,
  Scale,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  addKnowledgeObservation,
  archiveKnowledgeRecord,
  createKnowledgeRecord,
  fetchKnowledgeObservations,
  fetchKnowledgeRecord,
  fetchKnowledgeRecords,
  fetchKnowledgeRevisions,
  moveKnowledgeRecordToCollection,
  saveKnowledgeRecord,
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

const CONFIG = Object.freeze({
  "business-rules": {
    itemKey: "businessRule",
    entityType: "business_rule",
    label: "Regra de negócio",
    plural: "regras de negócio",
    permission: "business_rules",
    icon: Scale,
    statuses: [
      ["draft", "Rascunho"],
      ["active", "Ativa"],
      ["retired", "Retirada"],
    ],
    defaultStatus: "draft",
  },
  "architecture-decisions": {
    itemKey: "architectureDecision",
    entityType: "architecture_decision",
    label: "Decisão arquitetural",
    plural: "decisões arquiteturais",
    permission: "architecture_decisions",
    icon: GitBranch,
    statuses: [
      ["proposed", "Proposta"],
      ["accepted", "Aceita"],
      ["rejected", "Rejeitada"],
      ["superseded", "Substituída"],
    ],
    defaultStatus: "proposed",
  },
});

const TABS = [
  ["content", "Conteúdo"],
  ["context", "Contexto"],
  ["references", "Referências"],
  ["observations", "Observações"],
  ["revisions", "Revisões"],
  ["history", "Histórico"],
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function emptyDraft(config, collectionId = "") {
  return {
    id: "",
    title: "",
    markdown: "",
    applicationId: "",
    affectedComponentIds: [],
    collectionId,
    status: config.defaultStatus,
    references: [],
    definedAt: today(),
    lastReviewedAt: "",
    nextReviewAt: "",
  };
}

function normalizedDraft(config, record = {}) {
  return {
    ...emptyDraft(config),
    ...record,
    affectedComponentIds: record.affectedComponentIds || [],
    references: record.references || [],
  };
}

export function KnowledgeRecordsView({ actor, type }) {
  const config = CONFIG[type];
  const Icon = config.icon;
  const canCreate = hasPermission(actor, `${config.permission}.create`);
  const canUpdate = hasPermission(actor, `${config.permission}.update`);
  const canArchive = hasPermission(actor, `${config.permission}.archive`);
  const catalog = useCatalogOptions(
    hasPermission(actor, "applications.read") &&
      hasPermission(actor, "components.read"),
    actor.workspaceId,
  );
  const [items, setItems] = useState([]);
  const [organizationItems, setOrganizationItems] = useState([]);
  const [draft, setDraft] = useState(null);
  const [search, setSearch] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [componentFilter, setComponentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const collectionsState = useResourceCollections(type, {
    onError: setError,
    onMoved: () => load(),
  });

  async function load(
    searchValue = search,
    applicationValue = applicationFilter,
    componentValue = componentFilter,
  ) {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchKnowledgeRecords(type, {
        search: searchValue,
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
    void load("", "", "");
  }, [type]);

  async function openRecord(record) {
    setError("");
    try {
      const payload = await fetchKnowledgeRecord(type, record.id);
      setDraft(normalizedDraft(config, payload[config.itemKey]));
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
        ? await saveKnowledgeRecord(type, nextDraft.id, nextDraft)
        : await createKnowledgeRecord(type, nextDraft);
      const saved = payload[config.itemKey];
      setDraft(normalizedDraft(config, saved));
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
      await archiveKnowledgeRecord(type, record.id);
      if (draft?.id === record.id) setDraft(null);
      await load();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  async function moveItem(id, collectionId) {
    await moveKnowledgeRecordToCollection(type, id, collectionId);
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
      <div className="proceduresToolbar">
        <div />
        {canCreate ? (
          <button
            className="primaryButton"
            onClick={() =>
              setDraft(
                emptyDraft(
                  config,
                  searchActive ? "" : collectionsState.selectedCollectionId,
                ),
              )
            }
            type="button"
          >
            <Plus size={16} /> Nova {config.label.toLocaleLowerCase("pt-BR")}
          </button>
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
            ? `${collectionPathLabel(
                collectionsState.collections,
                draft.collectionId,
              )} / ${draft.title || `Nova ${config.label.toLocaleLowerCase("pt-BR")}`}`
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
            itemLabel={config.plural}
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
            renderItem={(record) => (
              <>
                <Icon size={13} /> <span>{record.title}</span>
              </>
            )}
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
              placeholder={`Buscar ${config.plural}`}
              search={search}
            />
          )
        }
      >
        {draft ? (
          <KnowledgeRecordDetail
            canArchive={canArchive}
            canUpdate={canUpdate || (!draft.id && canCreate)}
            catalog={catalog}
            config={config}
            draft={draft}
            onArchive={() => archive(draft)}
            onChange={setDraft}
            onSave={persist}
            saving={saving}
            type={type}
          />
        ) : (
          <section className="resourceCollectionContent">
            {loading ? (
              <div className="loadingLine">Carregando {config.plural}...</div>
            ) : null}
            {!loading && !visibleItems.length ? (
              <IllustratedEmptyState
                description={`Crie a primeira ${config.label.toLocaleLowerCase(
                  "pt-BR",
                )} para registrar o conhecimento do workspace.`}
                icon={Icon}
                title={`Nenhuma ${config.label.toLocaleLowerCase(
                  "pt-BR",
                )} encontrada`}
              />
            ) : null}
            <div className="procedureCards">
              {visibleItems.map((record) => (
                <article
                  className="procedureCard draggableProcedureCard"
                  key={record.id}
                >
                  <header>
                    <div>
                      <GripVertical size={15} />
                      <Icon size={18} />
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
                  <p className="procedureCardSummary">
                    {config.statuses.find(
                      ([value]) => value === record.status,
                    )?.[1] || record.status}{" "}
                    · definida em {record.definedAt || "data não informada"}
                  </p>
                </article>
              ))}
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
          resourceLabel={config.plural}
        />
      ) : null}
    </section>
  );
}

function KnowledgeRecordDetail({
  canArchive,
  canUpdate,
  catalog,
  config,
  draft,
  onArchive,
  onChange,
  onSave,
  saving,
  type,
}) {
  const [tab, setTab] = useState("content");
  const [observations, setObservations] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [observationDraft, setObservationDraft] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [referenceOptions, setReferenceOptions] = useState([]);

  useEffect(() => {
    if (!draft.id) return;
    Promise.all([
      fetchKnowledgeObservations(type, draft.id),
      fetchKnowledgeRevisions(type, draft.id),
    ]).then(([observationPayload, revisionPayload]) => {
      setObservations(observationPayload.items || []);
      setRevisions(revisionPayload.items || []);
    });
  }, [draft.id, refreshKey, type]);

  useEffect(() => {
    if (!draft.applicationId) {
      setReferenceOptions([]);
      return;
    }
    Promise.allSettled(
      Object.keys(CONFIG).map(async (targetType) => {
        const payload = await fetchKnowledgeRecords(targetType, {
          applicationId: draft.applicationId,
          limit: 100,
        });
        return (payload.items || []).map((record) => ({
          id: record.id,
          title: record.title,
          targetType,
        }));
      }),
    )
      .then((groups) =>
        setReferenceOptions(
          groups
            .filter(({ status }) => status === "fulfilled")
            .flatMap(({ value }) => value)
            .filter(({ id }) => id !== draft.id),
        ),
      )
      .catch(() => setReferenceOptions([]));
  }, [draft.applicationId, draft.id]);

  return (
    <section className="resourceCollectionContent knowledgeRecordDetail">
      <header className="dialogHeader">
        <div>
          <BookMarked size={20} />
          <h2>{draft.title || config.label}</h2>
        </div>
        <div>
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
      <nav className="dialogTabs" aria-label={`Detalhes de ${config.label}`}>
        {TABS.filter(
          ([key]) =>
            draft.id || !["observations", "revisions", "history"].includes(key),
        ).map(([key, label]) => (
          <button
            className={tab === key ? "activeDialogTab" : ""}
            key={key}
            onClick={() => setTab(key)}
            type="button"
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "content" ? (
        <div className="dialogForm">
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
      {tab === "context" ? (
        <div className="dialogForm">
          <CatalogContextFields
            affectedComponentIds={draft.affectedComponentIds}
            applicationId={draft.applicationId}
            applications={catalog.applications}
            components={catalog.components}
            disabled={!canUpdate}
            onChange={(context) => onChange({ ...draft, ...context })}
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
        <div className="dialogForm">
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
                  await addKnowledgeObservation(
                    type,
                    draft.id,
                    observationDraft,
                  );
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
        <div className="dialogForm">
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
        <AuditHistory
          entityId={draft.id}
          entityType={config.entityType}
          refreshKey={refreshKey}
        />
      ) : null}
    </section>
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
    <div className="dialogForm">
      {draft.references.map((reference, index) => (
        <div className="formGrid" key={index}>
          <label className="field">
            <span>Tipo</span>
            <select
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...draft,
                  references: draft.references.map((item, itemIndex) =>
                    itemIndex === index
                      ? {
                          ...item,
                          targetType: event.target.value,
                          targetId: "",
                        }
                      : item,
                  ),
                })
              }
              value={reference.targetType}
            >
              <option value="business-rules">Regra de negócio</option>
              <option value="architecture-decisions">
                Decisão arquitetural
              </option>
            </select>
          </label>
          <label className="field">
            <span>Registro referenciado</span>
            <select
              disabled={disabled}
              onChange={(event) =>
                update(index, "targetId", event.target.value)
              }
              value={reference.targetId}
            >
              <option value="">Selecione...</option>
              {options
                .filter(({ targetType }) => targetType === reference.targetType)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title}
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
                {
                  targetType: "business-rules",
                  targetId: "",
                  relationship: "related",
                },
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
