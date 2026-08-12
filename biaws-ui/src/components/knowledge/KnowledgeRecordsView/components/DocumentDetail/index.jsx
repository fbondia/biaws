import { AuditHistory } from "../../../../shared/AuditHistory.jsx";
import { MarkdownEditor } from "../../../../shared/MarkdownEditor/index.jsx";
import { guidelineScope, DOCUMENT_TYPES } from "../../model.js";
import {
  DocumentObservations,
  DocumentRevisions,
} from "./DocumentActivityPanels.jsx";
import {
  KnowledgeDocumentReading,
  KnowledgeRecordHeader,
  KnowledgeRecordTabs,
} from "./DocumentChrome.jsx";
import { DocumentFilesPanel } from "./DocumentFilesPanel.jsx";
import { DocumentOverview } from "./DocumentOverview.jsx";
import { ReferencesEditor } from "./ReferencesEditor.jsx";
import { useDocumentDetail } from "./hooks/useDocumentDetail.js";

export function DocumentDetail({
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
  const {
    addObservation,
    observationDraft,
    observations,
    referenceOptions,
    refreshKey,
    revisions,
    setObservationDraft,
    setShowDetails,
    setTab,
    showDetails,
    tab,
  } = useDocumentDetail(draft);

  function changeContext(context) {
    if (draft.documentType !== "guideline") {
      onChange({ ...draft, ...context });
      return;
    }
    onChange({
      ...draft,
      ...context,
      details: { ...draft.details, scope: guidelineScope(draft, context) },
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
        <DocumentOverview
          canUpdate={canUpdate}
          catalog={catalog}
          config={config}
          draft={draft}
          onChange={onChange}
          onContextChange={changeContext}
          taxonomyPackage={taxonomyPackage}
        />
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
        <DocumentObservations
          canUpdate={canUpdate}
          observationDraft={observationDraft}
          observations={observations}
          onAdd={addObservation}
          onDraftChange={setObservationDraft}
        />
      ) : null}
      {tab === "revisions" ? (
        <DocumentRevisions
          canUpdate={canUpdate}
          draft={draft}
          onSave={onSave}
          revisions={revisions}
        />
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
