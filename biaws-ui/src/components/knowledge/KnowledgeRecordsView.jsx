import {
  Archive,
  BookMarked,
  BookOpen,
  Boxes,
  Eye,
  FileText,
  FolderTree,
  GitBranch,
  GripVertical,
  ListChecks,
  Plus,
  Save,
  Scale,
  Settings2,
  Tags,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  addDocumentObservation,
  archiveDocument,
  createDocument,
  deleteEntityAttachment,
  downloadEntityAttachment,
  fetchDocument,
  fetchEntityAttachment,
  fetchDocumentObservations,
  fetchDocumentRevisions,
  fetchDocuments,
  fetchIssueTaxonomy,
  moveDocumentToCollection,
  saveDocument,
  updateEntityAttachmentTags,
  uploadEntityAttachments,
} from "../../api.js";
import { hasPermission } from "../../permissions.js";
import { DEFAULT_TAG_GROUP_COLOR } from "../../constants/issues.js";
import {
  CatalogContextDialogField,
  CatalogFilterFields,
  useCatalogOptions,
} from "../catalog/CatalogContextFields.jsx";
import { AuditHistory } from "../shared/AuditHistory.jsx";
import { FilesPanel } from "../shared/FilesPanel.jsx";
import { IllustratedEmptyState } from "../shared/IllustratedEmptyState.jsx";
import { FilterDialogButton } from "../shared/FilterDialogButton.jsx";
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
import { TaxonomySelector } from "../taxonomy/TaxonomySelector.jsx";
import { filterTaxonomyForApplication } from "../taxonomy/scope.js";
import {
  createEmptyDocumentDraft,
  documentStatusLabel,
  fetchAllDocumentPages,
  normalizeDocumentDraft,
  todayIso,
} from "./knowledgeModel.js";

const DOCUMENT_TYPES = Object.freeze({
  "business-rule": {
    label: "Regra de negócio",
    plural: "Regras de negócio",
    description: "Formalize regras, condições e exceções do negócio.",
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
    description: "Registre uma decisão técnica, seu contexto e consequências.",
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
    description: "Oriente práticas e padrões recomendados para o workspace.",
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
    description: "Descreva uma capacidade, seus fluxos e visão técnica.",
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
    description: "Documente arquitetura, interfaces e detalhes operacionais.",
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
  procedure: {
    label: "Procedimento",
    plural: "Procedimentos",
    description: "Registre instruções operacionais reutilizáveis.",
    icon: ListChecks,
    statuses: [
      ["draft", "Rascunho"],
      ["published", "Publicado"],
      ["deprecated", "Descontinuado"],
    ],
    defaultStatus: "draft",
    details: {},
    template:
      "## Objetivo\n\n## Pré-requisitos\n\n## Passos\n\n## Validação\n\n## Rollback\n",
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
  ["overview", "Visão Geral"],
  ["content", "Conteúdo"],
  ["references", "Referências"],
  ["files", "Arquivos"],
  ["observations", "Observações"],
  ["revisions", "Revisões"],
  ["history", "Histórico"],
];

function emptyDraft(documentType, collectionId = "") {
  return createEmptyDocumentDraft(DOCUMENT_TYPES, documentType, collectionId);
}

function normalizedDraft(record = {}) {
  return normalizeDocumentDraft(DOCUMENT_TYPES, record);
}

function statusLabel(document) {
  return documentStatusLabel(DOCUMENT_TYPES, document);
}

function guidelineScope(draft, context) {
  if (!context.applicationId) return "workspace";
  if (context.affectedComponentIds?.length) return "component";
  return draft.details.scope === "workspace"
    ? "application"
    : draft.details.scope;
}

function taxonomyIds(nodes = []) {
  return nodes.flatMap((node) => [
    node.id,
    ...taxonomyIds(node.children || []),
  ]);
}

function KnowledgeRecordCard({ canArchive, onArchive, onOpen, record }) {
  const config = DOCUMENT_TYPES[record.documentType];
  const TypeIcon = config?.icon || FileText;
  return (
    <article className="procedureCard draggableProcedureCard">
      <header>
        <div>
          <GripVertical size={15} />
          <TypeIcon size={18} />
          <h2>{record.title}</h2>
        </div>
        <div>
          <button
            className="iconButton"
            onClick={() => onOpen(record)}
            title="Visualizar"
            type="button"
          >
            <Eye size={16} />
          </button>
          {canArchive ? (
            <button
              className="iconButton dangerIconButton"
              onClick={() => onArchive(record)}
              title="Arquivar"
              type="button"
            >
              <Archive size={16} />
            </button>
          ) : null}
        </div>
      </header>
      <span className={`documentTypeBadge documentType-${record.documentType}`}>
        {config?.label || record.documentType}
      </span>
      <p>{record.summary}</p>
      <p className="procedureCardSummary">
        {statusLabel(record)} · definida em{" "}
        {record.definedAt || "data não informada"}
      </p>
    </article>
  );
}

function KnowledgeRecordHeader({
  canArchive,
  canUpdate,
  config,
  draft,
  onArchive,
  onClose,
  onSave,
  saving,
  titleId,
}) {
  const TypeIcon = config.icon;
  return (
    <header className="knowledgeRecordHeader">
      <div className="knowledgeRecordTitle">
        <TypeIcon className="knowledgeDocumentTypeIcon" size={44} />
        <div>
          <span
            className={`documentTypeBadge documentType-${draft.documentType}`}
          >
            {config.label}
          </span>
          <h2 id={titleId}>{draft.title || config.label}</h2>
        </div>
      </div>
      <div className="knowledgeRecordActions">
        {draft.id && canArchive ? (
          <button className="secondaryButton" onClick={onArchive} type="button">
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

        {draft.id ? (
          <button
            aria-label="Fechar detalhes"
            className="iconButton knowledgeDocumentModeButton"
            data-dialog-close
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>
    </header>
  );
}

function KnowledgeDocumentReading({ config, draft, onShowDetails }) {
  const TypeIcon = config.icon;
  return (
    <section className="resourceCollectionContent knowledgeRecordDetail knowledgeDocumentReading">
      <header className="knowledgeRecordHeader knowledgeDocumentReadingHeader">
        <div className="knowledgeRecordTitle">
          <TypeIcon className="knowledgeDocumentTypeIcon" size={44} />
          <div>
            <span
              className={`documentTypeBadge documentType-${draft.documentType}`}
            >
              {config.label}
            </span>
            <h2>{draft.title}</h2>
          </div>
        </div>
        <button
          className="knowledgeDetailsButton"
          onClick={onShowDetails}
          type="button"
        >
          <Settings2 size={15} />
          Detalhes
        </button>
      </header>
      <article className="knowledgeDocumentMarkdown">
        <MarkdownPreview value={draft.markdown} />
      </article>
    </section>
  );
}

function KnowledgeRecordTabs({
  canReadAttachments,
  documentId,
  onSelect,
  tab,
}) {
  const visibleTabs = documentId
    ? TABS.filter(([key]) => key !== "files" || canReadAttachments)
    : TABS.filter(
        ([key]) =>
          !["files", "observations", "revisions", "history"].includes(key),
      );
  return (
    <nav
      className="detailTabs knowledgeRecordTabs"
      aria-label="Detalhes do documento"
    >
      {visibleTabs.map(([key, label]) => (
        <button
          className={tab === key ? "detailTab activeDetailTab" : "detailTab"}
          key={key}
          onClick={() => onSelect(key)}
          type="button"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function KnowledgeCollectionDialog({ collectionsState }) {
  if (!collectionsState.collectionDialog) return null;
  async function save(name) {
    await collectionsState.saveCollection(name);
    collectionsState.setCollectionDialog(null);
  }
  return (
    <ResourceCollectionDialog
      collection={collectionsState.collectionDialog}
      onClose={() => collectionsState.setCollectionDialog(null)}
      onSave={save}
      resourceLabel="documentos"
    />
  );
}

function KnowledgeRecordList({
  canArchive,
  loading,
  onArchive,
  onOpen,
  records,
}) {
  return (
    <section className="resourceCollectionContent">
      {loading ? (
        <div className="loadingLine">Carregando documentos...</div>
      ) : null}
      {!loading && !records.length ? (
        <IllustratedEmptyState
          description="Crie o primeiro documento para registrar conhecimento governado do workspace."
          icon={BookMarked}
          title="Nenhum documento encontrado"
        />
      ) : null}
      <div className="procedureCards">
        {records.map((record) => (
          <KnowledgeRecordCard
            canArchive={canArchive}
            key={record.id}
            onArchive={onArchive}
            onOpen={onOpen}
            record={record}
          />
        ))}
      </div>
    </section>
  );
}

function DocumentTypeSelection({ onContinue, onSelect, selectedType }) {
  return (
    <section className="documentTypeCreationStep">
      <header>
        <span className="documentTypeCreationEyebrow">Novo documento</span>
        <h2>Qual tipo de documento você quer criar?</h2>
        <p>
          Escolha o tipo que melhor representa o conhecimento que será
          registrado.
        </p>
      </header>
      <div
        aria-label="Tipos de documento disponíveis"
        className="documentTypeCreationGrid"
        role="group"
      >
        {Object.entries(DOCUMENT_TYPES).map(([value, config]) => {
          const TypeIcon = config.icon;
          const selected = selectedType === value;
          return (
            <button
              aria-pressed={selected}
              className={
                selected
                  ? "documentTypeCreationCard selected"
                  : "documentTypeCreationCard"
              }
              key={value}
              onClick={() => onSelect(value)}
              type="button"
            >
              <span className="documentTypeCreationIcon">
                <TypeIcon aria-hidden="true" size={24} />
              </span>
              <span className="documentTypeCreationCopy">
                <strong>{config.label}</strong>
                <small>{config.description}</small>
              </span>
            </button>
          );
        })}
      </div>
      <footer>
        <button
          className="primaryButton"
          disabled={!selectedType}
          onClick={() => onContinue(selectedType)}
          type="button"
        >
          Continuar
        </button>
      </footer>
    </section>
  );
}

function ImmutableTypeHint({ documentId }) {
  return documentId ? (
    <small>O tipo é imutável depois que o documento é criado.</small>
  ) : null;
}

export function KnowledgeRecordsView({ actor }) {
  const canCreate = hasPermission(actor, "documents.create");
  const canUpdate = hasPermission(actor, "documents.update");
  const canArchive = hasPermission(actor, "documents.archive");
  const canReadAttachments = hasPermission(actor, "documents.attachment.read");
  const canCreateAttachments = hasPermission(
    actor,
    "documents.attachment.create",
  );
  const canUpdateAttachments = hasPermission(
    actor,
    "documents.attachment.update",
  );
  const canDeleteAttachments = hasPermission(
    actor,
    "documents.attachment.delete",
  );
  const catalog = useCatalogOptions(
    hasPermission(actor, "applications.read") &&
      hasPermission(actor, "components.read"),
    actor.workspaceId,
  );
  const [items, setItems] = useState([]);
  const [organizationItems, setOrganizationItems] = useState([]);
  const [taxonomyPackage, setTaxonomyPackage] = useState(null);
  const [draft, setDraft] = useState(null);
  const [creating, setCreating] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [createType, setCreateType] = useState("");
  const [search, setSearch] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [componentFilter, setComponentFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const loadVersionRef = useRef(0);
  const mountedRef = useRef(true);
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
    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;
    setLoading(true);
    setError("");
    try {
      const payload = await fetchAllDocumentPages(fetchDocuments, {
        search: searchValue,
        documentType: typeValue,
        applicationId: applicationValue,
        componentId: componentValue,
      });
      if (!mountedRef.current || loadVersion !== loadVersionRef.current) return;
      const loaded = payload.items || [];
      setItems(loaded);
      const filtered = Boolean(
        searchValue || applicationValue || componentValue,
      );
      if (!filtered) setOrganizationItems(loaded);
      setSearchActive(filtered);
    } catch (loadError) {
      if (mountedRef.current && loadVersion === loadVersionRef.current) {
        setError(loadError.message);
      }
    } finally {
      if (mountedRef.current && loadVersion === loadVersionRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void load("", "", "", typeFilter);
  }, [typeFilter]);

  useEffect(() => {
    if (!hasPermission(actor, "taxonomy.read")) return;
    fetchIssueTaxonomy()
      .then((payload) => setTaxonomyPackage(payload.taxonomy || null))
      .catch(() => setTaxonomyPackage(null));
  }, [actor]);

  async function openRecord(record) {
    setError("");
    setCreating(false);
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
              setCreating(false);
              setTypeFilter(value);
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
            <button
              className="primaryButton"
              onClick={() => {
                setDraft(null);
                setCreateType("");
                setCreating(true);
              }}
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
      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}
      <ResourceCollectionsShell
        collections={collectionsState.collections}
        detailVisible={Boolean(draft) || creating}
        draggedItem={collectionsState.draggedItem}
        onDropRoot={() => collectionsState.dropItem("", moveItem)}
        onNavigateBack={() => {
          setDraft(null);
          setCreating(false);
        }}
        onSelectCollection={collectionsState.setSelectedCollectionId}
        pathLabel={
          draft
            ? `${collectionPathLabel(collectionsState.collections, draft.collectionId)} / ${draft.title || `Novo ${DOCUMENT_TYPES[draft.documentType].label.toLocaleLowerCase("pt-BR")}`}`
            : creating
              ? `${collectionPathLabel(collectionsState.collections, searchActive ? "" : collectionsState.selectedCollectionId)} / Novo documento`
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
            preferenceKey="documents"
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
              setCreating(false);
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
          draft || creating ? null : (
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
        {creating ? (
          <DocumentTypeSelection
            onContinue={(documentType) => {
              setDraft(
                emptyDraft(
                  documentType,
                  searchActive ? "" : collectionsState.selectedCollectionId,
                ),
              );
              setCreating(false);
            }}
            onSelect={setCreateType}
            selectedType={createType}
          />
        ) : draft ? (
          <DocumentDetail
            canArchive={canArchive}
            canCreateAttachments={canCreateAttachments}
            canDeleteAttachments={canDeleteAttachments}
            canReadAttachments={canReadAttachments}
            canUpdate={canUpdate || (!draft.id && canCreate)}
            canUpdateAttachments={canUpdateAttachments}
            catalog={catalog}
            draft={draft}
            key={draft.id || `new-${draft.documentType}`}
            onArchive={() => archive(draft)}
            onChange={setDraft}
            onSave={persist}
            saving={saving}
            taxonomyPackage={taxonomyPackage}
          />
        ) : (
          <KnowledgeRecordList
            canArchive={canArchive}
            loading={loading}
            onArchive={archive}
            onOpen={openRecord}
            records={visibleItems}
          />
        )}
      </ResourceCollectionsShell>
      <KnowledgeCollectionDialog collectionsState={collectionsState} />
    </section>
  );
}

function DocumentDetail({
  canArchive,
  canCreateAttachments,
  canDeleteAttachments,
  canReadAttachments,
  canUpdate,
  canUpdateAttachments,
  catalog,
  draft,
  onArchive,
  onChange,
  onSave,
  saving,
  taxonomyPackage,
}) {
  const config = DOCUMENT_TYPES[draft.documentType];
  const [tab, setTab] = useState("overview");
  const [showDetails, setShowDetails] = useState(!draft.id);
  const [observations, setObservations] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [observationDraft, setObservationDraft] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [referenceOptions, setReferenceOptions] = useState([]);

  useEffect(() => {
    if (!draft.id) return;
    let active = true;
    Promise.all([
      fetchDocumentObservations(draft.id),
      fetchDocumentRevisions(draft.id),
    ])
      .then(([observationPayload, revisionPayload]) => {
        if (!active) return;
        setObservations(observationPayload.items || []);
        setRevisions(revisionPayload.items || []);
      })
      .catch(() => {
        if (active) {
          setObservations([]);
          setRevisions([]);
        }
      });
    return () => {
      active = false;
    };
  }, [draft.id, refreshKey]);

  useEffect(() => {
    let active = true;
    fetchAllDocumentPages(fetchDocuments)
      .then((payload) =>
        active
          ? setReferenceOptions(
              (payload.items || []).filter(({ id }) => id !== draft.id),
            )
          : undefined,
      )
      .catch(() => {
        if (active) setReferenceOptions([]);
      });
    return () => {
      active = false;
    };
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
    const scope = guidelineScope(draft, context);
    onChange({
      ...draft,
      ...context,
      details: { ...draft.details, scope },
    });
  }

  const detailsPanel = (
    <section
      aria-labelledby={draft.id ? "knowledgeDetailsDialogTitle" : undefined}
      aria-modal={draft.id ? "true" : undefined}
      className={
        draft.id
          ? "knowledgeDetailsDialog"
          : "resourceCollectionContent knowledgeRecordDetail"
      }
      role={draft.id ? "dialog" : undefined}
    >
      <KnowledgeRecordHeader
        canArchive={canArchive}
        canUpdate={canUpdate}
        config={config}
        draft={draft}
        onArchive={onArchive}
        onClose={() => setShowDetails(false)}
        onSave={onSave}
        saving={saving}
        titleId={draft.id ? "knowledgeDetailsDialogTitle" : undefined}
      />
      <KnowledgeRecordTabs
        canReadAttachments={canReadAttachments}
        documentId={draft.id}
        onSelect={setTab}
        tab={tab}
      />
      {tab === "overview" ? (
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
          <ImmutableTypeHint documentId={draft.id} />
          <DocumentDetailsFields
            disabled={!canUpdate}
            draft={draft}
            onChange={onChange}
          />
          <section className="knowledgeOverviewSection">
            <h3>Contexto e classificação</h3>
            <div className="knowledgeOverviewSelectors">
              <CatalogContextDialogField
                affectedComponentIds={draft.affectedComponentIds}
                applicationId={draft.applicationId || ""}
                applications={catalog.applications}
                components={catalog.components}
                disabled={!canUpdate}
                onChange={changeContext}
                optional={[
                  "guideline",
                  "procedure",
                  "technical-reference",
                ].includes(draft.documentType)}
              />
              <DocumentClassificationSelectors
                applications={catalog.applications}
                disabled={!canUpdate}
                draft={draft}
                onChange={onChange}
                taxonomyPackage={taxonomyPackage}
              />
            </div>
          </section>
          <section className="knowledgeOverviewSection">
            <h3>Governança e origem</h3>
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
          </section>
        </div>
      ) : null}
      {tab === "content" ? (
        <div className="dialogForm knowledgeRecordPanel">
          <div className="field">
            <MarkdownEditor
              onChange={(markdown) => onChange({ ...draft, markdown })}
              value={draft.markdown}
            />
          </div>
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
      {tab === "files" && draft.id && canReadAttachments ? (
        <DocumentFilesPanel
          canCreate={canCreateAttachments}
          canDelete={canDeleteAttachments}
          canUpdate={canUpdateAttachments}
          draft={draft}
          onChange={onChange}
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
          {draft.id && canUpdate ? (
            <button
              className="secondaryButton"
              onClick={() =>
                onSave({
                  ...draft,
                  lastReviewedAt: todayIso(),
                  changeSummary: "Conteúdo revisado",
                })
              }
              type="button"
            >
              Marcar como revisado hoje
            </button>
          ) : null}
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

  if (!draft.id) return detailsPanel;

  return (
    <>
      <KnowledgeDocumentReading
        config={config}
        draft={draft}
        onShowDetails={() => setShowDetails(true)}
      />
      {showDetails ? (
        <div
          className="dialogBackdrop knowledgeDetailsBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowDetails(false);
          }}
          role="presentation"
        >
          {detailsPanel}
        </div>
      ) : null}
    </>
  );
}

function DocumentClassificationSelectors({
  applications,
  disabled,
  draft,
  onChange,
  taxonomyPackage,
}) {
  const [taxonomyDialogOpen, setTaxonomyDialogOpen] = useState(false);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const classification = draft.classification || {
    primaryTaxonomyId: "",
    secondaryTaxonomyIds: [],
    tags: {},
  };
  const selectedIds = [
    ...new Set(
      [
        classification.primaryTaxonomyId,
        ...(classification.secondaryTaxonomyIds || []),
      ].filter(Boolean),
    ),
  ];
  const taxonomyNodes = filterTaxonomyForApplication(
    taxonomyPackage?.taxonomy || [],
    draft.applicationId,
  );
  const tagGroups = taxonomyPackage?.tagGroups || [];
  const selectedTagCount = Object.values(classification.tags || {}).reduce(
    (count, values) => count + values.length,
    0,
  );

  function updateClassification(next) {
    onChange({ ...draft, classification: { ...classification, ...next } });
  }

  function updateTaxonomies(nextIds) {
    const primaryTaxonomyId = nextIds.includes(classification.primaryTaxonomyId)
      ? classification.primaryTaxonomyId
      : nextIds[0] || "";
    updateClassification({
      primaryTaxonomyId,
      secondaryTaxonomyIds: nextIds.filter((id) => id !== primaryTaxonomyId),
    });
  }

  function toggleTag(groupId, tagId) {
    const selected = classification.tags?.[groupId] || [];
    updateClassification({
      tags: {
        ...(classification.tags || {}),
        [groupId]: selected.includes(tagId)
          ? selected.filter((id) => id !== tagId)
          : [...selected, tagId],
      },
    });
  }

  return (
    <>
      <FilterDialogButton
        count={selectedIds.length}
        icon={FolderTree}
        label="Classificações"
        onClick={() => setTaxonomyDialogOpen(true)}
        summary={
          selectedIds.length
            ? `${selectedIds.length} selecionada(s)`
            : "Nenhuma classificação"
        }
      />
      <FilterDialogButton
        count={selectedTagCount}
        icon={Tags}
        label="Tags"
        onClick={() => setTagsDialogOpen(true)}
        summary={
          selectedTagCount
            ? `${selectedTagCount} selecionada(s)`
            : "Nenhuma tag"
        }
      />

      {taxonomyDialogOpen ? (
        <div
          className="tagFilterDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              setTaxonomyDialogOpen(false);
          }}
        >
          <section
            aria-label="Selecionar classificações do documento"
            aria-modal="true"
            className="tagFilterDialog taxonomyFilterDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Selecionar classificações</strong>
                <span>
                  Selecione os assuntos e defina um deles como principal.
                </span>
              </div>
              {selectedIds.length ? (
                <small>{selectedIds.length} selecionada(s)</small>
              ) : null}
            </header>
            <div className="taxonomyFilterDialogContent">
              {taxonomyNodes.length ? (
                <TaxonomySelector
                  applications={applications}
                  disabledIds={disabled ? taxonomyIds(taxonomyNodes) : []}
                  multiple
                  nodes={taxonomyNodes}
                  onChange={disabled ? () => {} : updateTaxonomies}
                  onPrimaryChange={
                    disabled
                      ? undefined
                      : (primaryTaxonomyId) =>
                          updateClassification({
                            primaryTaxonomyId,
                            secondaryTaxonomyIds: selectedIds.filter(
                              (id) => id !== primaryTaxonomyId,
                            ),
                          })
                  }
                  primaryValue={classification.primaryTaxonomyId}
                  value={selectedIds}
                />
              ) : (
                <div className="emptyState compactEmpty">
                  Nenhuma taxonomia disponível para este contexto.
                </div>
              )}
            </div>
            <footer>
              {!disabled && selectedIds.length ? (
                <button
                  className="secondaryButton clearDialogSelectionButton"
                  onClick={() => updateTaxonomies([])}
                  type="button"
                >
                  Limpar seleção
                </button>
              ) : null}
              <button
                className="primaryButton"
                data-dialog-close
                onClick={() => setTaxonomyDialogOpen(false)}
                type="button"
              >
                Concluir
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {tagsDialogOpen ? (
        <div
          className="tagFilterDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setTagsDialogOpen(false);
          }}
        >
          <section
            aria-label="Selecionar tags do documento"
            aria-modal="true"
            className="tagFilterDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Selecionar tags</strong>
                <span>Marque as tags que devem identificar o documento.</span>
              </div>
              {selectedTagCount ? (
                <small>{selectedTagCount} selecionada(s)</small>
              ) : null}
            </header>
            {tagGroups.length ? (
              <div className="tagFilterGroups">
                {tagGroups.map((group) => (
                  <div className="tagFilterGroup" key={group.id}>
                    <strong>
                      <span
                        className="tagColorSwatch"
                        style={{
                          backgroundColor:
                            group.color || DEFAULT_TAG_GROUP_COLOR,
                        }}
                      />
                      {group.label}
                    </strong>
                    <div className="tagFilterOptions">
                      {(group.tags || []).map((tagId) => {
                        const checked = Boolean(
                          classification.tags?.[group.id]?.includes(tagId),
                        );
                        return (
                          <label
                            className={
                              checked
                                ? "tagFilterOption selectedTagFilterOption"
                                : "tagFilterOption"
                            }
                            key={tagId}
                            style={{
                              borderColor: checked
                                ? group.color || DEFAULT_TAG_GROUP_COLOR
                                : undefined,
                            }}
                          >
                            <input
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleTag(group.id, tagId)}
                              type="checkbox"
                            />
                            <span>{tagId}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="emptyState compactEmpty">
                Nenhuma tag disponível.
              </div>
            )}
            <footer>
              {!disabled && selectedTagCount ? (
                <button
                  className="secondaryButton clearDialogSelectionButton"
                  onClick={() => updateClassification({ tags: {} })}
                  type="button"
                >
                  Limpar seleção
                </button>
              ) : null}
              <button
                className="primaryButton"
                data-dialog-close
                onClick={() => setTagsDialogOpen(false)}
                type="button"
              >
                Concluir
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}

function DocumentFilesPanel({
  canCreate,
  canDelete,
  canUpdate,
  draft,
  onChange,
}) {
  function applyDocument(document) {
    onChange(normalizedDraft(document));
  }

  return (
    <div className="dialogForm knowledgeRecordPanel">
      <FilesPanel
        canCreate={canCreate}
        canDelete={canDelete}
        canUpdate={canUpdate}
        files={draft.attachments || []}
        onDelete={async (attachment) => {
          const payload = await deleteEntityAttachment(
            "knowledge/documents",
            draft.id,
            attachment,
          );
          applyDocument(payload.document);
          return payload.deleted;
        }}
        onDownload={(attachment) =>
          downloadEntityAttachment("knowledge/documents", draft.id, attachment)
        }
        onPreview={(attachment) =>
          fetchEntityAttachment("knowledge/documents", draft.id, attachment)
        }
        onUpdateTags={async (attachment, tags) => {
          const payload = await updateEntityAttachmentTags(
            "knowledge/documents",
            draft.id,
            attachment,
            tags,
          );
          applyDocument(payload.document);
        }}
        onUpload={async (files) => {
          const payload = await uploadEntityAttachments(
            "knowledge/documents",
            draft.id,
            files,
          );
          applyDocument(payload.document);
          return payload.uploaded?.length;
        }}
      />
    </div>
  );
}

function updateDetails(draft, onChange, field, value) {
  onChange({ ...draft, details: { ...draft.details, [field]: value } });
}

function DocumentDetailsFields({ disabled, draft, onChange }) {
  if (draft.documentType === "procedure") return null;
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
