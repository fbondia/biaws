import { IssueDetailContent } from "./components/IssueDetailContent.jsx";
import { IssueDetailsLayout } from "./components/IssueDetailsLayout.jsx";
import { IssueIdentityDialog } from "./components/IssueIdentityDialog.jsx";
import { useIssueDetailsDialog } from "./hooks/useIssueDetailsDialog.js";
import { useIssueIdentityEditor } from "./hooks/useIssueIdentityEditor.js";

export function IssueDetailsDialog({
  applications = [],
  canEditContext = false,
  canCreateComment = false,
  canDeleteComment = false,
  canUpdateComment = false,
  components = [],
  details,
  error,
  loading,
  onClose,
  onIssueUpdated,
  onIssueDetailsUpdated,
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
    savingSummary,
    summaryError,
    summaryMessage,
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
    hasSummaryChanges,
    saveContext,
    closeOnBackdrop,
    updateTaxonomies,
    updatePrimaryTaxonomy,
    removeTaxonomy,
    toggleGroupTag,
    removeGroupTag,
    updateKbSummary,
    saveClassification,
    saveSummary,
    addTaxonomyCatalogNode,
    editTaxonomyCatalogNode,
    TypeIcon,
    typeLabel,
    editableStatusOptions,
  } = useIssueDetailsDialog({
    details,
    onClose,
    onIssueUpdated,
    preview,
  });
  const identityEditor = useIssueIdentityEditor({ issue, onIssueUpdated });

  return (
    <>
      <IssueDetailsLayout
        activeTab={activeTab}
        closeOnBackdrop={closeOnBackdrop}
        editableStatusOptions={editableStatusOptions}
        error={error}
        issue={issue}
        loading={loading}
        onClose={onClose}
        onEditIdentity={canEditContext ? identityEditor.openEditor : undefined}
        onUpdateIssueField={onUpdateIssueField}
        persistedClassification={persistedClassification}
        selectedTagEntries={selectedTagEntries}
        setActiveTab={setActiveTab}
        taxonomyById={taxonomyById}
        TypeIcon={TypeIcon}
        typeLabel={typeLabel}
        updatingIssueField={updatingIssueField}
      >
        <IssueDetailContent
          activeTab={activeTab}
          activeTagGroup={activeTagGroup}
          addTaxonomyCatalogNode={addTaxonomyCatalogNode}
          applications={applications}
          attachments={attachments}
          canCreateComment={canCreateComment}
          canDeleteComment={canDeleteComment}
          canEditContext={canEditContext}
          canUpdateComment={canUpdateComment}
          classificationDraft={classificationDraft}
          classificationMessage={classificationMessage}
          comments={comments}
          components={components}
          contextDraft={contextDraft}
          contextError={contextError}
          draftSelectedTagEntries={draftSelectedTagEntries}
          editTaxonomyCatalogNode={editTaxonomyCatalogNode}
          hasClassificationChanges={hasClassificationChanges}
          hasSummaryChanges={hasSummaryChanges}
          issue={issue}
          loading={loading}
          onIssueDetailsUpdated={onIssueDetailsUpdated}
          onIssueUpdated={onIssueUpdated}
          removeGroupTag={removeGroupTag}
          removeTaxonomy={removeTaxonomy}
          saveClassification={saveClassification}
          saveSummary={saveSummary}
          saveContext={saveContext}
          savingClassification={savingClassification}
          savingSummary={savingSummary}
          summaryError={summaryError}
          summaryMessage={summaryMessage}
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
      </IssueDetailsLayout>
      {canEditContext && identityEditor.editing ? (
        <IssueIdentityDialog
          canSave={identityEditor.canSave}
          draft={identityEditor.draft}
          error={identityEditor.error}
          identifierError={identityEditor.identifierError}
          onChange={identityEditor.setDraft}
          onClose={identityEditor.closeEditor}
          onSave={identityEditor.saveIdentity}
          saving={identityEditor.saving}
        />
      ) : null}
    </>
  );
}
