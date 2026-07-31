import { MessageSquare, Save, Tags, X } from "lucide-react";

import {
  deleteEntityAttachment,
  downloadEntityAttachment,
  fetchEntityAttachment,
  updateEntityAttachmentTags,
  uploadEntityAttachments,
} from "../../../api.js";
import {
  ALL_STATUS_OPTIONS,
  DEFAULT_TAG_GROUP_COLOR,
} from "../../../constants/issues.js";
import { formatDate, statusClass } from "../../../utils/issues.js";
import { CatalogContextFields } from "../../catalog/CatalogContextFields.jsx";
import { AuditHistory } from "../../shared/AuditHistory.jsx";
import { FilesPanel } from "../../shared/FilesPanel.jsx";
import { TaxonomySelector } from "../../taxonomy/TaxonomySelector.jsx";
import { filterTaxonomyForApplication } from "../../taxonomy/scope.js";
import {
  DETAIL_TABS,
  getTaxonomyDisplayValue,
  optionLabel,
  TagGroupDialog,
  TagSelectionChips,
  TaxonomySelectionChips,
} from "./components/ClassificationControls.jsx";
import { useIssueDetailsDialog } from "./hooks/useIssueDetailsDialog.js";

export function IssueDetailsDialog({
  applications = [],
  canEditContext = false,
  components = [],
  details,
  error,
  loading,
  onClose,
  onIssueUpdated,
  onUpdateIssueField,
  preview,
  updatingIssueField,
}) {
  const {
    issue,
    activeTab,
    setActiveTab,
    setActiveTagGroupId,
    taxonomyPackage,
    taxonomyLoading,
    taxonomyError,
    classificationDraft,
    savingClassification,
    classificationMessage,
    savingTaxonomyCatalog,
    contextDraft,
    setContextDraft,
    savingContext,
    contextError,
    comments,
    attachments,
    taxonomyById,
    persistedClassification,
    selectedTagEntries,
    draftSelectedTagEntries,
    selectedTaxonomies,
    activeTagGroup,
    hasClassificationChanges,
    saveContext,
    closeOnBackdrop,
    updateTaxonomies,
    updatePrimaryTaxonomy,
    removeTaxonomy,
    toggleGroupTag,
    removeGroupTag,
    updateKbSummary,
    saveClassification,
    addTaxonomyCatalogNode,
    editTaxonomyCatalogNode,
    TypeIcon,
    typeLabel,
    editableStatusOptions,
  } = useIssueDetailsDialog({ details, onClose, onIssueUpdated, preview });
  return (
    <div className="dialogBackdrop" onMouseDown={closeOnBackdrop}>
      <section
        aria-labelledby="issue-dialog-title"
        aria-modal="true"
        className="issueDialog"
        role="dialog"
      >
        <header className="dialogHeader">
          <div className="dialogTitleBlock">
            <div className="dialogKicker">
              <span className="codeCell">{issue.id || "Issue"}</span>
              <span className="typeBadge">
                <TypeIcon size={14} />
                {typeLabel}
              </span>
              <select
                aria-label="Status do issue"
                className={`dialogStatusSelect inlineIssueSelect inlineStatusSelect ${statusClass(issue.status)}`}
                disabled={
                  loading ||
                  updatingIssueField === `${issue.id}:status` ||
                  !onUpdateIssueField
                }
                onChange={(event) =>
                  onUpdateIssueField?.(issue, "status", event.target.value)
                }
                value={
                  editableStatusOptions.some(
                    (option) => option.value === issue.status,
                  )
                    ? issue.status
                    : ""
                }
              >
                {editableStatusOptions.some(
                  (option) => option.value === issue.status,
                ) ? null : (
                  <option value="" disabled>
                    {optionLabel(ALL_STATUS_OPTIONS, issue.status)}
                  </option>
                )}
                {editableStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <h2 id="issue-dialog-title">
              {issue.title || "Detalhes do issue"}
            </h2>
          </div>
          <button
            className="iconButton"
            type="button"
            onClick={onClose}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="dialogBody">
          {error ? <div className="errorBox dialogError">{error}</div> : null}
          {loading ? (
            <div className="loadingLine">Carregando detalhes...</div>
          ) : null}

          <section className="detailGrid" aria-label="Dados do issue">
            <div>
              <span>Recebimento</span>
              <strong>{formatDate(issue.dates?.receivedEmailAt)}</strong>
            </div>
            <div>
              <span>Criação</span>
              <strong>{formatDate(issue.dates?.issueCreatedAt)}</strong>
            </div>
            <div>
              <span>Atualização</span>
              <strong>{formatDate(issue.updatedAt)}</strong>
            </div>
            <div>
              <span>Fechamento</span>
              <strong>{formatDate(issue.dates?.closedAt)}</strong>
            </div>
            <div className="detailTaxonomyCard">
              <span>Assunto principal</span>
              <strong>
                {getTaxonomyDisplayValue(
                  taxonomyById,
                  persistedClassification.primaryTaxonomyId,
                )}
              </strong>
            </div>
            <div className="detailTaxonomyCard">
              <span>Assuntos secundários</span>
              <strong>
                {persistedClassification.secondaryTaxonomyIds.length
                  ? persistedClassification.secondaryTaxonomyIds
                      .map((taxonomyId) =>
                        getTaxonomyDisplayValue(taxonomyById, taxonomyId),
                      )
                      .join("; ")
                  : "Sem classificação"}
              </strong>
            </div>
            <div className="detailTaxonomyCard detailTagsCard">
              <span>Tags</span>
              {selectedTagEntries.length ? (
                <div className="detailTagList">
                  {selectedTagEntries.map((tag) => (
                    <span
                      className="issueTagPill"
                      key={`${tag.groupLabel}-${tag.tagId}`}
                    >
                      <span
                        className="tagColorSwatch"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.groupLabel}: {tag.tagId}
                    </span>
                  ))}
                </div>
              ) : (
                <strong>Sem tags</strong>
              )}
            </div>
          </section>

          <div
            className="detailTabs"
            role="tablist"
            aria-label="Conteúdo do issue"
          >
            {DETAIL_TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.key}
                className={
                  activeTab === tab.key
                    ? "detailTab activeDetailTab"
                    : "detailTab"
                }
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <IssueDetailContent
            activeTab={activeTab}
            activeTagGroup={activeTagGroup}
            addTaxonomyCatalogNode={addTaxonomyCatalogNode}
            applications={applications}
            attachments={attachments}
            canEditContext={canEditContext}
            classificationDraft={classificationDraft}
            classificationMessage={classificationMessage}
            comments={comments}
            components={components}
            contextDraft={contextDraft}
            contextError={contextError}
            draftSelectedTagEntries={draftSelectedTagEntries}
            editTaxonomyCatalogNode={editTaxonomyCatalogNode}
            hasClassificationChanges={hasClassificationChanges}
            issue={issue}
            loading={loading}
            onIssueUpdated={onIssueUpdated}
            removeGroupTag={removeGroupTag}
            removeTaxonomy={removeTaxonomy}
            saveClassification={saveClassification}
            saveContext={saveContext}
            savingClassification={savingClassification}
            savingContext={savingContext}
            savingTaxonomyCatalog={savingTaxonomyCatalog}
            selectedTaxonomies={selectedTaxonomies}
            setActiveTagGroupId={setActiveTagGroupId}
            setContextDraft={setContextDraft}
            taxonomyById={taxonomyById}
            taxonomyError={taxonomyError}
            taxonomyLoading={taxonomyLoading}
            taxonomyPackage={taxonomyPackage}
            toggleGroupTag={toggleGroupTag}
            updateKbSummary={updateKbSummary}
            updatePrimaryTaxonomy={updatePrimaryTaxonomy}
            updateTaxonomies={updateTaxonomies}
          />
        </div>
      </section>
    </div>
  );
}

function IssueDetailContent(props) {
  const Component = {
    comments: IssueCommentsTab,
    context: IssueContextTab,
    description: IssueDescriptionTab,
    files: IssueFilesTab,
    history: IssueHistoryTab,
    kb: IssueKnowledgeTab,
  }[props.activeTab];
  return Component ? <Component {...props} /> : null;
}

function IssueDescriptionTab({
  activeTagGroup,
  addTaxonomyCatalogNode,
  applications,
  attachments,
  canEditContext,
  classificationDraft,
  classificationMessage,
  comments,
  components,
  contextDraft,
  contextError,
  draftSelectedTagEntries,
  editTaxonomyCatalogNode,
  hasClassificationChanges,
  issue,
  loading,
  onIssueUpdated,
  persistedClassification,
  removeGroupTag,
  removeTaxonomy,
  saveClassification,
  saveContext,
  savingClassification,
  savingContext,
  savingTaxonomyCatalog,
  selectedTaxonomies,
  setActiveTagGroupId,
  setContextDraft,
  taxonomyById,
  taxonomyError,
  taxonomyLoading,
  taxonomyPackage,
  toggleGroupTag,
  updateKbSummary,
  updatePrimaryTaxonomy,
  updateTaxonomies,
}) {
  return (
    <section className="detailSection">
      <h3>Descrição</h3>
      <pre className="detailText">{issue.text || "-"}</pre>
    </section>
  );
}

function IssueContextTab({
  activeTagGroup,
  addTaxonomyCatalogNode,
  applications,
  attachments,
  canEditContext,
  classificationDraft,
  classificationMessage,
  comments,
  components,
  contextDraft,
  contextError,
  draftSelectedTagEntries,
  editTaxonomyCatalogNode,
  hasClassificationChanges,
  issue,
  loading,
  onIssueUpdated,
  persistedClassification,
  removeGroupTag,
  removeTaxonomy,
  saveClassification,
  saveContext,
  savingClassification,
  savingContext,
  savingTaxonomyCatalog,
  selectedTaxonomies,
  setActiveTagGroupId,
  setContextDraft,
  taxonomyById,
  taxonomyError,
  taxonomyLoading,
  taxonomyPackage,
  toggleGroupTag,
  updateKbSummary,
  updatePrimaryTaxonomy,
  updateTaxonomies,
}) {
  return (
    <section className="detailSection">
      <h3>Aplicação e impacto</h3>
      {contextError ? (
        <div className="errorBox dialogError">{contextError}</div>
      ) : null}
      <CatalogContextFields
        affectedComponentIds={contextDraft.affectedComponentIds}
        applicationId={contextDraft.applicationId}
        applications={applications}
        components={components}
        disabled={!canEditContext || savingContext}
        onChange={setContextDraft}
      />
      {canEditContext ? (
        <div className="catalogContextActions">
          <button
            className="primaryButton"
            disabled={!contextDraft.applicationId || savingContext}
            onClick={saveContext}
            type="button"
          >
            <Save size={16} />{" "}
            {savingContext ? "Salvando..." : "Salvar contexto"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function IssueCommentsTab({
  activeTagGroup,
  addTaxonomyCatalogNode,
  applications,
  attachments,
  canEditContext,
  classificationDraft,
  classificationMessage,
  comments,
  components,
  contextDraft,
  contextError,
  draftSelectedTagEntries,
  editTaxonomyCatalogNode,
  hasClassificationChanges,
  issue,
  loading,
  onIssueUpdated,
  persistedClassification,
  removeGroupTag,
  removeTaxonomy,
  saveClassification,
  saveContext,
  savingClassification,
  savingContext,
  savingTaxonomyCatalog,
  selectedTaxonomies,
  setActiveTagGroupId,
  setContextDraft,
  taxonomyById,
  taxonomyError,
  taxonomyLoading,
  taxonomyPackage,
  toggleGroupTag,
  updateKbSummary,
  updatePrimaryTaxonomy,
  updateTaxonomies,
}) {
  return (
    <section className="detailSection">
      <div className="sectionTitleRow">
        <h3>Comentários</h3>
        <span>
          <MessageSquare size={14} />
          {comments.length}
        </span>
      </div>
      {comments.length ? (
        <div className="commentList">
          {comments.map((comment) => (
            <article className="commentItem" key={comment._id || comment.hash}>
              <header>
                <strong>{comment.from || "Origem não identificada"}</strong>
                <span>{formatDate(comment.date || comment.createdAt)}</span>
              </header>
              {comment.to || comment.cc || comment.rawDate ? (
                <div className="commentMeta">
                  {comment.to ? <span>Para: {comment.to}</span> : null}
                  {comment.cc ? <span>Cc: {comment.cc}</span> : null}
                  {comment.rawDate ? (
                    <span>Data original: {comment.rawDate}</span>
                  ) : null}
                </div>
              ) : null}
              <pre>{comment.text || "-"}</pre>
            </article>
          ))}
        </div>
      ) : (
        <div className="emptyState compactEmpty">
          {loading
            ? "Carregando comentários..."
            : "Nenhum comentário registrado."}
        </div>
      )}
    </section>
  );
}

function IssueFilesTab({
  activeTagGroup,
  addTaxonomyCatalogNode,
  applications,
  attachments,
  canEditContext,
  classificationDraft,
  classificationMessage,
  comments,
  components,
  contextDraft,
  contextError,
  draftSelectedTagEntries,
  editTaxonomyCatalogNode,
  hasClassificationChanges,
  issue,
  loading,
  onIssueUpdated,
  persistedClassification,
  removeGroupTag,
  removeTaxonomy,
  saveClassification,
  saveContext,
  savingClassification,
  savingContext,
  savingTaxonomyCatalog,
  selectedTaxonomies,
  setActiveTagGroupId,
  setContextDraft,
  taxonomyById,
  taxonomyError,
  taxonomyLoading,
  taxonomyPackage,
  toggleGroupTag,
  updateKbSummary,
  updatePrimaryTaxonomy,
  updateTaxonomies,
}) {
  return (
    <FilesPanel
      files={attachments}
      onDelete={async (attachment) => {
        const payload = await deleteEntityAttachment(
          "issues",
          issue.id,
          attachment,
        );
        onIssueUpdated?.(payload.issue);
        return payload.deleted;
      }}
      onDownload={(attachment) =>
        downloadEntityAttachment("issues", issue.id, attachment)
      }
      onPreview={(attachment) =>
        fetchEntityAttachment("issues", issue.id, attachment)
      }
      onUpdateTags={async (attachment, tags) => {
        const payload = await updateEntityAttachmentTags(
          "issues",
          issue.id,
          attachment,
          tags,
        );
        onIssueUpdated?.(payload.issue);
      }}
      onUpload={async (files) => {
        const payload = await uploadEntityAttachments(
          "issues",
          issue.id,
          files,
        );
        onIssueUpdated?.(payload.issue);
        return payload.uploaded?.length;
      }}
    />
  );
}

function IssueHistoryTab({
  activeTagGroup,
  addTaxonomyCatalogNode,
  applications,
  attachments,
  canEditContext,
  classificationDraft,
  classificationMessage,
  comments,
  components,
  contextDraft,
  contextError,
  draftSelectedTagEntries,
  editTaxonomyCatalogNode,
  hasClassificationChanges,
  issue,
  loading,
  onIssueUpdated,
  persistedClassification,
  removeGroupTag,
  removeTaxonomy,
  saveClassification,
  saveContext,
  savingClassification,
  savingContext,
  savingTaxonomyCatalog,
  selectedTaxonomies,
  setActiveTagGroupId,
  setContextDraft,
  taxonomyById,
  taxonomyError,
  taxonomyLoading,
  taxonomyPackage,
  toggleGroupTag,
  updateKbSummary,
  updatePrimaryTaxonomy,
  updateTaxonomies,
}) {
  return (
    <AuditHistory
      entityId={issue.id}
      entityType="issue"
      refreshKey={issue.updatedAt}
    />
  );
}

function IssueKnowledgeTab({
  activeTagGroup,
  addTaxonomyCatalogNode,
  applications,
  attachments,
  canEditContext,
  classificationDraft,
  classificationMessage,
  comments,
  components,
  contextDraft,
  contextError,
  draftSelectedTagEntries,
  editTaxonomyCatalogNode,
  hasClassificationChanges,
  issue,
  loading,
  onIssueUpdated,
  persistedClassification,
  removeGroupTag,
  removeTaxonomy,
  saveClassification,
  saveContext,
  savingClassification,
  savingContext,
  savingTaxonomyCatalog,
  selectedTaxonomies,
  setActiveTagGroupId,
  setContextDraft,
  taxonomyById,
  taxonomyError,
  taxonomyLoading,
  taxonomyPackage,
  toggleGroupTag,
  updateKbSummary,
  updatePrimaryTaxonomy,
  updateTaxonomies,
}) {
  return (
    <section className="detailSection">
      {taxonomyError ? (
        <div className="errorBox dialogError">{taxonomyError}</div>
      ) : null}
      {classificationMessage ? (
        <div className="infoBox">{classificationMessage}</div>
      ) : null}
      {hasClassificationChanges ? (
        <div className="warningBox">
          Há alterações de classificação ainda não gravadas.
        </div>
      ) : null}

      {taxonomyLoading ? (
        <div className="loadingLine">Carregando assuntos...</div>
      ) : null}

      <div className="classificationGrid">
        <section className="classificationPanel kbSummaryPanel">
          <label className="field">
            <span>Sumário do que foi feito</span>
            <textarea
              onChange={(event) => updateKbSummary(event.target.value)}
              placeholder="Registre um resumo objetivo da análise, correção ou encaminhamento realizado."
              rows={4}
              value={classificationDraft.summary}
            />
          </label>
        </section>

        {/* TAGS */}
        <section className="classificationPanel taxonomyChooserPanel">
          <div className="sectionTitleRow">
            <h3>Tags</h3>
            <span>
              <Tags size={14} />
              {draftSelectedTagEntries?.length || 0}
            </span>
          </div>

          {taxonomyPackage?.tagGroups?.length ? (
            <div className="tagGroupButtons" aria-label="Grupos de tags">
              {taxonomyPackage.tagGroups.map((group) => (
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
          ) : null}

          <TagSelectionChips
            onRemove={removeGroupTag}
            tags={draftSelectedTagEntries}
          />
        </section>

        {/* ASSUNTO */}
        <section className="classificationPanel taxonomyChooserPanel">
          <div className="sectionTitleRow">
            <h3>Assunto</h3>
            <span>
              <Tags size={14} />
              {selectedTaxonomies?.length || 0}
            </span>
          </div>

          <TaxonomySelectionChips
            onClear={() => updateTaxonomies([])}
            onRemove={removeTaxonomy}
            primaryTaxonomyId={classificationDraft.primaryTaxonomyId}
            selectedTaxonomies={selectedTaxonomies}
            taxonomyById={taxonomyById}
          />

          <TaxonomySelector
            applications={applications}
            multiple
            nodes={filterTaxonomyForApplication(
              taxonomyPackage?.taxonomy || [],
              issue.applicationId,
            )}
            onAddNode={savingTaxonomyCatalog ? null : addTaxonomyCatalogNode}
            onChange={updateTaxonomies}
            onEditNode={savingTaxonomyCatalog ? null : editTaxonomyCatalogNode}
            onPrimaryChange={updatePrimaryTaxonomy}
            primaryValue={classificationDraft.primaryTaxonomyId}
            value={selectedTaxonomies}
          />

          <TagGroupDialog
            group={activeTagGroup}
            onClose={() => setActiveTagGroupId("")}
            onToggleTag={toggleGroupTag}
            selectedTags={
              activeTagGroup
                ? classificationDraft.tags[activeTagGroup.id] || []
                : []
            }
          />
        </section>
      </div>

      <div className="dialogActions">
        <button
          className="primaryButton"
          disabled={
            savingClassification || !hasClassificationChanges || !issue.id
          }
          onClick={saveClassification}
          type="button"
        >
          <Save size={16} />
          {savingClassification ? "Gravando..." : "Gravar KB"}
        </button>
      </div>
    </section>
  );
}
