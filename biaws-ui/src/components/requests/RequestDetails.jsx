import { Edit3, Eye, X } from "lucide-react";

import { REQUEST_DETAIL_TABS } from "./requestUtils.js";
import { RequestJourneyTab } from "./details/RequestJourneyTab.jsx";
import { RequestChecklistDialog } from "./details/RequestChecklistDialog.jsx";
import { RequestChecklistTab } from "./details/RequestChecklistTab.jsx";
import { RequestMainTab } from "./details/RequestMainTab.jsx";
import { RequestNotesTab } from "./details/RequestNotesTab.jsx";
import { RequestSpecificationTab } from "./details/RequestSpecificationTab.jsx";
import { RequestTasksTab } from "./details/RequestTasksTab.jsx";
import { FilesPanel } from "../shared/FilesPanel.jsx";
import { AuditHistory } from "../shared/AuditHistory.jsx";
import {
  deleteEntityAttachment,
  downloadEntityAttachment,
  fetchEntityAttachment,
  updateEntityAttachmentTags,
  uploadEntityAttachments,
} from "../../api.js";

export function RequestDetails({
  request,
  isEditing,
  activeTab,
  savingRequestId,
  selectedChecklistItem,
  journeyTotals,
  onTabChange,
  onToggleEditMode,
  onClose,
  onFieldChange,
  onDelete,
  onBeginNumberDraft,
  onUpdateNumberDraft,
  onClearNumberDraft,
  onReadDraftedNumber,
  onCommitEstimatedJourneys,
  onToggleChecklistItem,
  onUpdateChecklistItem,
  onCloseChecklistDialog,
  onJourneyMonthCommit,
  onJourneyCommentChange,
  onCreateNote,
  onCreateTask,
  onCreateTaskNote,
  onDeleteNote,
  onDeleteTask,
  onDeleteTaskNote,
  onAddSpecificationSection,
  onAddMissingSpecificationSections,
  onMoveSpecificationSection,
  onRemoveChecklistItem,
  onRemoveSpecificationSection,
  onUpdateNote,
  onUpdateTask,
  onUpdateTaskNote,
  onUpdateSpecificationSection,
  onRequestUpdated,
  onContextChange,
  applications,
  components,
}) {
  return (
    <div className="requestWorkArea">
      <div className="requestDetailTabsBar">
        <div
          className="detailTabs requestDetailTabs"
          role="tablist"
          aria-label="Detalhes da melhoria"
        >
          {REQUEST_DETAIL_TABS.map((tab) => (
            <button
              aria-selected={activeTab === tab.key}
              className={
                activeTab === tab.key
                  ? "detailTab activeDetailTab"
                  : "detailTab"
              }
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="requestDetailActions">
          <button
            className="secondaryButton"
            onClick={onToggleEditMode}
            type="button"
          >
            {isEditing ? <Eye size={16} /> : <Edit3 size={16} />}
            {isEditing ? "Concluir edição" : "Editar"}
          </button>
          <button className="secondaryButton" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
      </div>

      {activeTab === "main" ? (
        <RequestMainTab
          isEditing={isEditing}
          onBeginNumberDraft={onBeginNumberDraft}
          onClearNumberDraft={onClearNumberDraft}
          onCommitEstimatedJourneys={onCommitEstimatedJourneys}
          onDelete={onDelete}
          onFieldChange={onFieldChange}
          onReadDraftedNumber={onReadDraftedNumber}
          onUpdateNumberDraft={onUpdateNumberDraft}
          onContextChange={onContextChange}
          applications={applications}
          components={components}
          request={request}
          savingRequestId={savingRequestId}
        />
      ) : null}

      {activeTab === "notes" ? (
        <RequestNotesTab
          onCreateNote={onCreateNote}
          onDeleteNote={onDeleteNote}
          onUpdateNote={onUpdateNote}
          request={request}
          saving={savingRequestId === request.id}
        />
      ) : null}

      {activeTab === "specification" ? (
        <RequestSpecificationTab
          isEditing={isEditing}
          onAddSpecificationSection={onAddSpecificationSection}
          onAddMissingSpecificationSections={onAddMissingSpecificationSections}
          onMoveSpecificationSection={onMoveSpecificationSection}
          onRemoveSpecificationSection={onRemoveSpecificationSection}
          onUpdateSpecificationSection={onUpdateSpecificationSection}
          request={request}
        />
      ) : null}

      {activeTab === "tasks" ? (
        <RequestTasksTab
          onCreateTask={onCreateTask}
          onCreateTaskNote={onCreateTaskNote}
          onDeleteTask={onDeleteTask}
          onDeleteTaskNote={onDeleteTaskNote}
          onUpdateTask={onUpdateTask}
          onUpdateTaskNote={onUpdateTaskNote}
          onRequestUpdated={onRequestUpdated}
          request={request}
          saving={savingRequestId === request.id}
        />
      ) : null}

      {activeTab === "checklist" ? (
        <RequestChecklistTab
          isEditing={isEditing}
          onRemoveChecklistItem={onRemoveChecklistItem}
          onToggleChecklistItem={onToggleChecklistItem}
          request={request}
        />
      ) : null}

      {activeTab === "journeys" ? (
        <RequestJourneyTab
          journeyTotals={journeyTotals}
          isEditing={isEditing}
          onBeginNumberDraft={onBeginNumberDraft}
          onJourneyCommentChange={onJourneyCommentChange}
          onJourneyMonthCommit={onJourneyMonthCommit}
          onClearNumberDraft={onClearNumberDraft}
          onReadDraftedNumber={onReadDraftedNumber}
          onUpdateNumberDraft={onUpdateNumberDraft}
          request={request}
        />
      ) : null}

      {activeTab === "files" ? (
        <FilesPanel
          files={request.attachments || []}
          onDelete={async (attachment) => {
            const payload = await deleteEntityAttachment(
              "requests",
              request.id,
              attachment,
            );
            onRequestUpdated(payload.request);
            return payload.deleted;
          }}
          onDownload={(attachment) =>
            downloadEntityAttachment("requests", request.id, attachment)
          }
          onPreview={(attachment) =>
            fetchEntityAttachment("requests", request.id, attachment)
          }
          onUpdateTags={async (attachment, tags) => {
            const payload = await updateEntityAttachmentTags(
              "requests",
              request.id,
              attachment,
              tags,
            );
            onRequestUpdated(payload.request);
          }}
          onUpload={async (files) => {
            const payload = await uploadEntityAttachments(
              "requests",
              request.id,
              files,
            );
            onRequestUpdated(payload.request);
            return payload.uploaded?.length;
          }}
        />
      ) : null}

      {activeTab === "history" ? (
        <AuditHistory
          entityId={request.id}
          entityType="demand"
          refreshKey={request.updatedAt}
        />
      ) : null}

      <RequestChecklistDialog
        item={selectedChecklistItem}
        onClose={onCloseChecklistDialog}
        onUpdateChecklistItem={onUpdateChecklistItem}
      />
    </div>
  );
}
