import { IssueDetailContent } from "./components/IssueDetailContent.jsx";
import { IssueDetailsLayout } from "./components/IssueDetailsLayout.jsx";
import { useIssueDetailsDialog } from "./hooks/useIssueDetailsDialog.js";

export function IssueDetailsDialog({
  applications = [],
  canEditContext = false,
  canCreateComment = false,
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
  } = useIssueDetailsDialog({
    details,
    onClose,
    onIssueDetailsUpdated,
    preview,
  });

  return (
    <IssueDetailsLayout
      activeTab={activeTab}
      closeOnBackdrop={closeOnBackdrop}
      editableStatusOptions={editableStatusOptions}
      error={error}
      issue={issue}
      loading={loading}
      onClose={onClose}
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
        issue={issue}
        loading={loading}
        onIssueDetailsUpdated={onIssueDetailsUpdated}
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
    </IssueDetailsLayout>
  );
}
