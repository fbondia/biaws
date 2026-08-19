import { Edit3, Save, X } from "lucide-react";

import { REQUEST_DETAIL_TABS } from "./requestUtils.js";
import { RequestJourneyTab } from "./details/RequestJourneyTab.jsx";
import { RequestChecklistDialog } from "./details/RequestChecklistDialog.jsx";
import { RequestChecklistTab } from "./details/RequestChecklistTab.jsx";
import { RequestMainTab } from "./details/RequestMainTab.jsx";
import { RequestNotesTab } from "./details/RequestNotesTab.jsx";
import { RequestSpecificationTab } from "./details/RequestSpecificationTab.jsx";
import { RequestTasksTab } from "./details/RequestTasksTab.jsx";
import { FilesPanel } from "../shared/FilesPanel/index.jsx";
import { AuditHistory } from "../shared/AuditHistory.jsx";
import {
  deleteEntityAttachment,
  downloadEntityAttachment,
  fetchEntityAttachment,
  updateEntityAttachmentTags,
  uploadEntityAttachments,
} from "../../api.js";

function RequestDetailContent({
  request,
  isEditing,
  activeTab,
  initialTaskId,
  savingRequestId,
  journeyTotals,
  onFieldChange,
  onDelete,
  onBeginNumberDraft,
  onUpdateNumberDraft,
  onClearNumberDraft,
  onReadDraftedNumber,
  onCommitEstimatedJourneys,
  onToggleChecklistItem,
  onJourneyMonthCommit,
  onJourneyCommentChange,
  onInitialTaskHandled,
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
  onChangeStatus,
  onChangeTaskStatus,
  applications,
  components,
}) {
  switch (activeTab) {
    case "main":
      return (
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
          onChangeStatus={onChangeStatus}
          applications={applications}
          components={components}
          request={request}
          savingRequestId={savingRequestId}
        />
      );
    case "notes":
      return (
        <RequestNotesTab
          onCreateNote={onCreateNote}
          onDeleteNote={onDeleteNote}
          onUpdateNote={onUpdateNote}
          request={request}
          saving={savingRequestId === request.id}
        />
      );
    case "specification":
      return (
        <RequestSpecificationTab
          isEditing={isEditing}
          onAddSpecificationSection={onAddSpecificationSection}
          onAddMissingSpecificationSections={onAddMissingSpecificationSections}
          onMoveSpecificationSection={onMoveSpecificationSection}
          onRemoveSpecificationSection={onRemoveSpecificationSection}
          onUpdateSpecificationSection={onUpdateSpecificationSection}
          request={request}
        />
      );
    case "tasks":
      return (
        <RequestTasksTab
          initialTaskId={initialTaskId}
          onCreateTask={onCreateTask}
          onChangeStatus={
            onChangeTaskStatus
              ? (task, status) => onChangeTaskStatus(request, task, status)
              : undefined
          }
          onCreateTaskNote={onCreateTaskNote}
          onDeleteTask={onDeleteTask}
          onDeleteTaskNote={onDeleteTaskNote}
          onInitialTaskHandled={onInitialTaskHandled}
          onUpdateTask={onUpdateTask}
          onUpdateTaskNote={onUpdateTaskNote}
          onRequestUpdated={onRequestUpdated}
          request={request}
          saving={savingRequestId === request.id}
        />
      );
    case "checklist":
      return (
        <RequestChecklistTab
          isEditing={isEditing}
          onRemoveChecklistItem={onRemoveChecklistItem}
          onToggleChecklistItem={onToggleChecklistItem}
          request={request}
        />
      );
    case "journeys":
      return (
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
      );
    case "files":
      return (
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
      );
    case "history":
      return (
        <AuditHistory
          entityId={request.id}
          entityType="demand"
          refreshKey={request.updatedAt}
        />
      );
    default:
      return null;
  }
}

export function RequestDetails(props) {
  const {
    activeTab,
    isEditing,
    onClose,
    onCloseChecklistDialog,
    onTabChange,
    onToggleEditMode,
    selectedChecklistItem,
  } = props;
  return (
    <div className="requestWorkArea">
      <div className="requestDetailTabsBar">
        <div
          aria-label="Detalhes da melhoria"
          className="detailTabs requestDetailTabs"
          role="tablist"
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
            className="primaryButton"
            onClick={onToggleEditMode}
            type="button"
          >
            {isEditing ? <Save size={16} /> : <Edit3 size={16} />}
            {isEditing ? "Gravar" : "Editar"}
          </button>
          <button
            aria-label="Fechar detalhes da melhoria"
            className="secondaryButton"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <RequestDetailContent {...props} />

      <RequestChecklistDialog
        item={selectedChecklistItem}
        onClose={onCloseChecklistDialog}
        onUpdateChecklistItem={onUpdateChecklistItem}
      />
    </div>
  );
}
