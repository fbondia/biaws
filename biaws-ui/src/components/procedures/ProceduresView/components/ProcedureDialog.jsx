import { Crown, Eye, Pencil, Save, Tags, X } from "lucide-react";
import { useState } from "react";

import {
  deleteEntityAttachment,
  downloadEntityAttachment,
  fetchEntityAttachment,
  updateEntityAttachmentTags,
  uploadEntityAttachments,
} from "../../../../api.js";
import { DEFAULT_TAG_GROUP_COLOR } from "../../../../constants/issues.js";
import { formatDate, formatTaxonomyPath } from "../../../../utils/issues.js";
import { CatalogContextFields } from "../../../catalog/CatalogContextFields.jsx";
import { AuditHistory } from "../../../shared/AuditHistory.jsx";
import { FilesPanel } from "../../../shared/FilesPanel.jsx";
import {
  MarkdownEditor,
  MarkdownPreview,
} from "../../../shared/MarkdownEditor/index.jsx";
import { TaxonomySelector } from "../../../taxonomy/TaxonomySelector.jsx";
import { normalizeDraft, selectedTaxonomyIds, taxonomyById } from "../model.js";

export function TaxonomySelectionChips({
  classification,
  nodes,
  onRemove,
  onClear,
}) {
  const byId = taxonomyById(nodes);
  const selected = selectedTaxonomyIds(classification);
  if (!selected.length) return null;

  return (
    <div
      className="classificationTaxonomyChips"
      aria-label="Assuntos selecionados"
    >
      {selected.map((id) => {
        const primary = id === classification.primaryTaxonomyId;
        const label = byId[id]?.path?.join(" / ") || id;
        return (
          <span
            className={
              primary
                ? "classificationTaxonomyChip primaryTaxonomyChip"
                : "classificationTaxonomyChip"
            }
            key={id}
            title={label}
          >
            {primary ? (
              <Crown className="primaryTaxonomyIcon" size={13} />
            ) : null}
            {label}
            <button
              aria-label={`Remover ${label}`}
              onClick={() => onRemove(id)}
              title="Remover assunto"
              type="button"
            >
              <X size={13} />
            </button>
          </span>
        );
      })}
      <button
        className="classificationTaxonomyChip clearTaxonomyChip"
        onClick={onClear}
        type="button"
      >
        Limpar Tudo
      </button>
    </div>
  );
}

export function selectedTagEntries(classification, groups) {
  const knownGroupIds = new Set(groups.map((group) => group.id));
  const knownTags = groups.flatMap((group) =>
    (classification.tags[group.id] || []).map((tagId) => ({
      color: group.color || DEFAULT_TAG_GROUP_COLOR,
      groupId: group.id,
      groupLabel: group.label,
      tagId,
    })),
  );
  const unknownTags = Object.entries(classification.tags || {})
    .filter(([groupId]) => !knownGroupIds.has(groupId))
    .flatMap(([groupId, tagIds]) =>
      (Array.isArray(tagIds) ? tagIds : []).map((tagId) => ({
        color: DEFAULT_TAG_GROUP_COLOR,
        groupId,
        groupLabel: groupId,
        tagId,
      })),
    );

  return [...knownTags, ...unknownTags];
}

export function ProcedureClassificationSummary({ procedure, taxonomyPackage }) {
  const classification = procedure.classification || EMPTY_DRAFT.classification;
  const selectedIds = selectedTaxonomyIds(classification);
  const byId = taxonomyById(taxonomyPackage?.taxonomy || []);
  const tags = selectedTagEntries(
    classification,
    taxonomyPackage?.tagGroups || [],
  );

  return (
    <div className="procedureCardClassification">
      <div className="procedureCardClassificationGroup">
        <span>Assuntos</span>
        {selectedIds.length ? (
          <div className="issueTaxonomyList">
            {selectedIds.map((id) => {
              const primary = id === classification.primaryTaxonomyId;
              const label = byId[id]?.path?.join(" / ") || id;
              return (
                <span
                  className={
                    primary
                      ? "issueTaxonomyPill primaryIssueTaxonomyPill"
                      : "issueTaxonomyPill"
                  }
                  key={id}
                  title={label}
                >
                  {primary ? (
                    <Crown className="primaryTaxonomyIcon" size={13} />
                  ) : null}
                  {formatTaxonomyPath(byId[id]?.path || [id])}
                </span>
              );
            })}
          </div>
        ) : (
          <strong>-</strong>
        )}
      </div>
      <div className="procedureCardClassificationGroup">
        <span>Tags</span>
        {tags.length ? (
          <div className="issueTagList">
            {tags.map((tag) => (
              <span
                className="issueTagPill"
                key={`${tag.groupId}-${tag.tagId}`}
                style={{ borderColor: tag.color }}
                title={tag.groupLabel}
              >
                <span
                  className="tagColorSwatch"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.tagId}
              </span>
            ))}
          </div>
        ) : (
          <strong>-</strong>
        )}
      </div>
    </div>
  );
}

export function TagSelectionChips({ tags, onRemove }) {
  if (!tags.length) return null;
  return (
    <div className="classificationTagChips" aria-label="Tags selecionadas">
      {tags.map((tag) => (
        <span
          className="classificationTagChip"
          key={`${tag.groupId}-${tag.tagId}`}
          style={{ borderColor: tag.color }}
          title={tag.groupLabel}
        >
          <span
            className="tagColorSwatch"
            style={{ backgroundColor: tag.color }}
          />
          {tag.tagId}
          <button
            aria-label={`Remover tag ${tag.tagId}`}
            onClick={() => onRemove(tag.groupId, tag.tagId)}
            type="button"
          >
            <X size={13} />
          </button>
        </span>
      ))}
    </div>
  );
}

export function TagGroupDialog({ group, selectedTags, onToggle, onClose }) {
  if (!group) return null;
  return (
    <div
      className="tagPickerBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="presentation"
    >
      <section
        aria-label={`Selecionar tags de ${group.label}`}
        aria-modal="true"
        className="tagPickerDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>{group.label}</strong>
            {group.description ? <span>{group.description}</span> : null}
          </div>
          <button
            className="iconButton"
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={16} />
          </button>
        </header>
        {group.tags?.length ? (
          <div className="tagPickerGrid">
            {group.tags.map((tagId) => (
              <label className="checkItem compactCheckItem" key={tagId}>
                <input
                  checked={selectedTags.includes(tagId)}
                  onChange={() => onToggle(group.id, tagId)}
                  type="checkbox"
                />
                <span>{tagId}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            Nenhuma tag cadastrada neste grupo.
          </div>
        )}
      </section>
    </div>
  );
}

export function ProcedureDialog({
  draft,
  onChange,
  onClose,
  onPersistedChange,
  onSave,
  saving,
  taxonomyPackage,
  applications,
  components,
}) {
  const [activeTab, setActiveTab] = useState("procedure");
  const [activeTagGroupId, setActiveTagGroupId] = useState("");
  const [mode, setMode] = useState(draft.id ? "view" : "edit");
  const [persistedDraft, setPersistedDraft] = useState(() =>
    normalizeDraft(draft),
  );
  const selectedIds = selectedTaxonomyIds(draft.classification);
  const taxonomyNodes = taxonomyPackage?.taxonomy || [];
  const tagGroups = taxonomyPackage?.tagGroups || [];
  const activeTagGroup = tagGroups.find(
    (group) => group.id === activeTagGroupId,
  );
  const tags = selectedTagEntries(draft.classification, tagGroups);

  function updateClassification(patch) {
    onChange({
      ...draft,
      classification: { ...draft.classification, ...patch },
    });
  }

  function updateTaxonomies(next) {
    const primary = next.includes(draft.classification.primaryTaxonomyId)
      ? draft.classification.primaryTaxonomyId
      : next[0] || "";
    updateClassification({
      primaryTaxonomyId: primary,
      secondaryTaxonomyIds: next.filter((item) => item !== primary),
    });
  }

  function updatePrimaryTaxonomy(primaryTaxonomyId) {
    updateClassification({
      primaryTaxonomyId,
      secondaryTaxonomyIds: selectedIds.filter(
        (id) => id !== primaryTaxonomyId,
      ),
    });
  }

  function toggleTag(groupId, tag) {
    const current = draft.classification.tags[groupId] || [];
    updateClassification({
      tags: {
        ...draft.classification.tags,
        [groupId]: current.includes(tag)
          ? current.filter((item) => item !== tag)
          : [...current, tag],
      },
    });
  }

  function cancelEditing() {
    onChange(normalizeDraft(persistedDraft));
    setMode("view");
    setActiveTagGroupId("");
  }

  function applyPersistedAttachmentChange(procedure) {
    const persistedProcedure = normalizeDraft(procedure);
    const attachmentState = {
      attachments: persistedProcedure.attachments || [],
      updatedAt: persistedProcedure.updatedAt,
      updatedBy: persistedProcedure.updatedBy,
    };
    setPersistedDraft((current) => ({ ...current, ...attachmentState }));
    onChange((current) => ({ ...current, ...attachmentState }));
    onPersistedChange(persistedProcedure);
  }

  return (
    <div
      className="dialogBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section aria-modal="true" className="procedureDialog" role="dialog">
        <ProcedureDialogHeader
          cancelEditing={cancelEditing}
          draft={draft}
          mode={mode}
          onClose={onClose}
          setMode={setMode}
        />
        <div className="procedureDialogBody">
          <ProcedureDialogTabs
            activeTab={activeTab}
            draft={draft}
            onSelect={setActiveTab}
          />

          <ProcedureDialogContent
            activeTab={activeTab}
            activeTagGroup={activeTagGroup}
            applications={applications}
            applyPersistedAttachmentChange={applyPersistedAttachmentChange}
            components={components}
            draft={draft}
            mode={mode}
            onChange={onChange}
            selectedIds={selectedIds}
            setActiveTagGroupId={setActiveTagGroupId}
            tagGroups={tagGroups}
            tags={tags}
            taxonomyNodes={taxonomyNodes}
            taxonomyPackage={taxonomyPackage}
            toggleTag={toggleTag}
            updatePrimaryTaxonomy={updatePrimaryTaxonomy}
            updateTaxonomies={updateTaxonomies}
          />
        </div>
        <ProcedureDialogFooter
          cancelEditing={cancelEditing}
          draft={draft}
          mode={mode}
          onClose={onClose}
          onSave={onSave}
          saving={saving}
        />
      </section>
    </div>
  );
}

function ProcedureDialogHeader({
  cancelEditing,
  draft,
  mode,
  onClose,
  setMode,
}) {
  const editing = mode === "edit";
  const kicker = draft.id
    ? editing
      ? "Editar procedimento"
      : "Visualizar procedimento"
    : "Novo procedimento";
  function toggleMode() {
    if (editing) cancelEditing();
    else setMode("edit");
  }
  return (
    <header className="procedureDialogHeader">
      <div>
        <span>{kicker}</span>
        <h2>{draft.title || "Procedimento sem título"}</h2>
      </div>
      <div className="procedureDialogHeaderActions">
        {draft.id ? (
          <button
            className={
              editing
                ? "secondaryButton activeProcedureModeButton"
                : "secondaryButton"
            }
            onClick={toggleMode}
            type="button"
          >
            {editing ? <Eye size={16} /> : <Pencil size={16} />}
            {editing ? "Visualizar" : "Editar"}
          </button>
        ) : null}
        <button className="iconButton" onClick={onClose} type="button">
          <X size={18} />
        </button>
      </div>
    </header>
  );
}

function ProcedureDialogTabs({ activeTab, draft, onSelect }) {
  const tabs = [
    ["procedure", "Procedimento"],
    ["context", "Aplicação"],
    ["classification", "Classificação"],
    ...(draft.id
      ? [
          ["files", "Arquivos"],
          ["history", "Histórico"],
        ]
      : []),
  ];
  return (
    <div className="detailTabs" role="tablist">
      {tabs.map(([key, label]) => (
        <button
          className={
            activeTab === key ? "detailTab activeDetailTab" : "detailTab"
          }
          key={key}
          onClick={() => onSelect(key)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ProcedureDialogContent(props) {
  const Component = {
    classification: ProcedureClassificationTab,
    context: ProcedureContextTab,
    files: ProcedureFilesTab,
    history: ProcedureHistoryTab,
    procedure: ProcedureMainTab,
  }[props.activeTab];
  return Component ? <Component {...props} /> : null;
}

function ProcedureHistoryTab({ draft }) {
  return (
    <AuditHistory
      entityId={draft.id}
      entityType="procedure"
      refreshKey={draft.updatedAt}
    />
  );
}

function ProcedureFilesTab({ applyPersistedAttachmentChange, draft }) {
  async function deleteAttachment(attachment) {
    const payload = await deleteEntityAttachment(
      "procedures",
      draft.id,
      attachment,
    );
    applyPersistedAttachmentChange(payload.procedure);
    return payload.deleted;
  }
  async function updateTags(attachment, tags) {
    const payload = await updateEntityAttachmentTags(
      "procedures",
      draft.id,
      attachment,
      tags,
    );
    applyPersistedAttachmentChange(payload.procedure);
  }
  async function upload(files) {
    const payload = await uploadEntityAttachments(
      "procedures",
      draft.id,
      files,
    );
    applyPersistedAttachmentChange(payload.procedure);
    return payload.uploaded?.length;
  }
  return (
    <FilesPanel
      files={draft.attachments || []}
      onDelete={deleteAttachment}
      onDownload={(attachment) =>
        downloadEntityAttachment("procedures", draft.id, attachment)
      }
      onPreview={(attachment) =>
        fetchEntityAttachment("procedures", draft.id, attachment)
      }
      onUpdateTags={updateTags}
      onUpload={upload}
    />
  );
}

function ProcedureContextTab({
  applications,
  components,
  draft,
  mode,
  onChange,
}) {
  if (mode === "edit")
    return (
      <section className="procedureMainTab">
        <CatalogContextFields
          affectedComponentIds={draft.affectedComponentIds}
          applicationId={draft.applicationId}
          applications={applications}
          components={components}
          onChange={(context) => onChange({ ...draft, ...context })}
          optional
        />
      </section>
    );
  const applicationName =
    applications.find(({ id }) => id === draft.applicationId)?.name ||
    "Conhecimento geral do workspace";
  return (
    <section className="procedureMainTab">
      <div className="requestDetailCard">
        <span>Aplicação</span>
        <strong>{applicationName}</strong>
      </div>

      <div className="requestDetailCard">
        <span>Componentes afetados</span>
        <strong>{draft.affectedComponentIds.length}</strong>
      </div>
    </section>
  );
}

function ProcedureMainTab({ draft, mode, onChange }) {
  if (mode === "edit")
    return <ProcedureEditTab draft={draft} onChange={onChange} />;
  return <ProcedureReadTab draft={draft} />;
}

function ProcedureEditTab({ draft, onChange }) {
  return (
    <section className="procedureMainTab">
      <label className="field">
        <span>Título</span>
        <input
          autoFocus
          onChange={(event) =>
            onChange({ ...draft, title: event.target.value })
          }
          value={draft.title}
        />
      </label>
      <label className="field">
        <span>Sumário</span>
        <textarea
          onChange={(event) =>
            onChange({ ...draft, summary: event.target.value })
          }
          placeholder="Resumo sucinto para a lista de procedimentos"
          rows={3}
          value={draft.summary}
        />
      </label>
      <ProcedureDates draft={draft} />
      <label className="field procedureMarkdownField">
        <span>Descrição do procedimento (Markdown)</span>
        <MarkdownEditor
          onChange={(procedure) => onChange({ ...draft, procedure })}
          value={draft.procedure}
        />
      </label>
    </section>
  );
}

function ProcedureReadTab({ draft }) {
  return (
    <section className="procedureMainTab">
      <div className="procedureViewTitle">
        <span>Título</span>
        <h3>{draft.title}</h3>
      </div>
      <div className="procedureViewSummary">
        <span>Sumário</span>
        <p>{draft.summary || "Sumário não informado"}</p>
      </div>
      <ProcedureDates draft={draft} />
      <section className="procedureViewContent">
        <span>Descrição do procedimento</span>
        <MarkdownPreview value={draft.procedure} />
      </section>
    </section>
  );
}

function ProcedureDates({ draft }) {
  return (
    <div className="procedureDates">
      <div>
        <span>Data de criação</span>
        <strong>
          {draft.createdAt
            ? formatDate(draft.createdAt)
            : "Será definida ao salvar"}
        </strong>
      </div>
      <div>
        <span>Última revisão</span>
        <strong>
          {draft.updatedAt
            ? formatDate(draft.updatedAt)
            : "Será definida ao salvar"}
        </strong>
      </div>
    </div>
  );
}

function ProcedureClassificationTab(props) {
  if (props.mode === "edit") return <ProcedureEditClassification {...props} />;
  return (
    <section className="procedureClassificationView">
      <ProcedureClassificationSummary
        procedure={props.draft}
        taxonomyPackage={props.taxonomyPackage}
      />
    </section>
  );
}

function ProcedureEditClassification({
  activeTagGroup,
  draft,
  selectedIds,
  setActiveTagGroupId,
  tagGroups,
  tags,
  taxonomyNodes,
  toggleTag,
  updatePrimaryTaxonomy,
  updateTaxonomies,
}) {
  const selectedTags = activeTagGroup
    ? draft.classification.tags[activeTagGroup.id] || []
    : [];
  return (
    <section className="classificationGrid">
      <section className="classificationPanel taxonomyChooserPanel">
        <div className="sectionTitleRow">
          <h3>Tags</h3>
          <span>
            <Tags size={14} />
            {tags.length}
          </span>
        </div>
        {tagGroups.length ? (
          <div className="tagGroupButtons" aria-label="Grupos de tags">
            {tagGroups.map((group) => (
              <button
                className="tagGroupButton"
                key={group.id}
                onClick={() => setActiveTagGroupId(group.id)}
                style={{
                  backgroundColor: group.color || DEFAULT_TAG_GROUP_COLOR,
                }}
                type="button"
              >
                {group.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            Nenhum grupo de tags cadastrado.
          </div>
        )}
        <TagSelectionChips tags={tags} onRemove={toggleTag} />
      </section>
      <section className="classificationPanel taxonomyChooserPanel">
        <div className="sectionTitleRow">
          <h3>Assunto</h3>
          <span>
            <Tags size={14} />
            {selectedIds.length}
          </span>
        </div>
        <TaxonomySelectionChips
          classification={draft.classification}
          nodes={taxonomyNodes}
          onClear={() => updateTaxonomies([])}
          onRemove={(id) =>
            updateTaxonomies(selectedIds.filter((item) => item !== id))
          }
        />
        <TaxonomySelector
          multiple
          nodes={taxonomyNodes}
          onChange={updateTaxonomies}
          onPrimaryChange={updatePrimaryTaxonomy}
          primaryValue={draft.classification.primaryTaxonomyId}
          value={selectedIds}
        />
      </section>
      <TagGroupDialog
        group={activeTagGroup}
        onClose={() => setActiveTagGroupId("")}
        onToggle={toggleTag}
        selectedTags={selectedTags}
      />
    </section>
  );
}

function ProcedureDialogFooter({
  cancelEditing,
  draft,
  mode,
  onClose,
  onSave,
  saving,
}) {
  if (mode !== "edit")
    return (
      <footer className="procedureDialogFooter">
        <button className="secondaryButton" onClick={onClose} type="button">
          Fechar
        </button>
      </footer>
    );
  return (
    <footer className="procedureDialogFooter">
      <button
        className="secondaryButton"
        onClick={draft.id ? cancelEditing : onClose}
        type="button"
      >
        Cancelar
      </button>
      <button
        className="primaryButton"
        disabled={
          saving ||
          !draft.title.trim() ||
          !draft.summary.trim() ||
          !draft.procedure.trim()
        }
        onClick={onSave}
        type="button"
      >
        <Save size={16} /> {saving ? "Salvando..." : "Salvar procedimento"}
      </button>
    </footer>
  );
}
