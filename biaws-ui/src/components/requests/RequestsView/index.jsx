import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import "../../../styles/features/requests/index.css";

import { moveRequestToCollection } from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import { CatalogFilterFields } from "../../catalog/CatalogContextFields/index.jsx";
import {
  collectionPathLabel,
  ResourceCollectionNavigator,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import { useResourceCollections } from "../../shared/useResourceCollections.js";
import { RequestDetails } from "../RequestDetails.jsx";
import {
  normalizeRequest,
  requestStatusLabel,
  requestStatusStyle,
} from "../requestUtils.js";
import { RequestDialogs } from "./components/RequestDialogs.jsx";
import { RequestPagination } from "./components/RequestPagination.jsx";
import { RequestsOverview } from "./components/RequestsOverview.jsx";
import { RequestStatusFilter } from "./components/RequestStatusFilter.jsx";
import { useRequestsView } from "./hooks/useRequestsView.js";

function RequestError({ collectionError, requestError }) {
  const message = requestError || collectionError;
  if (!message) return null;
  return (
    <div className="errorBox requestErrorBox" role="alert">
      {message}
    </div>
  );
}

export function RequestsView({
  actor,
  initialTaskTarget,
  onInitialTaskTargetHandled,
}) {
  const [collectionError, setCollectionError] = useState("");
  const [taskToOpenId, setTaskToOpenId] = useState("");
  const collectionState = useResourceCollections("demands", {
    onError: setCollectionError,
  });
  const {
    catalog,
    savingRequestId,
    addRequest,
    requestError,
    selectedRequest,
    applicationFilter,
    setApplicationFilter,
    componentFilter,
    setComponentFilter,
    setRequestPage,
    statusFilters,
    filteredRequests,
    loadingRequests,
    moveRequest,
    requestMeta,
    requestCollectionItems,
    loadRequests,
    loadRequestCollectionItems,
    loadSelectedRequest,
    selectRequest,
    setStatusFilters,
    selectedRequestId,
    activeDetailTab,
    selectedExecutedTotal,
    selectedOverExecutedTotal,
    selectedPlannedJourneyTotal,
    selectedPendingTotal,
    isEditing,
    beginNumberDraft,
    updateJourneyComment,
    commitJourneyMonth,
    addRequestNote,
    addRequestTask,
    addRequestTaskNote,
    addSpecificationSection,
    addMissingSpecificationSections,
    clearNumberDraft,
    closeChecklistDialog,
    closeSelectedRequest,
    commitEstimatedJourneys,
    removeSelectedRequest,
    removeRequestNote,
    removeRequestTask,
    removeRequestTaskNote,
    removeChecklistItem,
    updateSelectedField,
    moveSpecificationSection,
    readDraftedNumber,
    upsertRequestInList,
    updateRequest,
    schedulePersistRequest,
    removeSpecificationSection,
    setActiveDetailTab,
    toggleChecklistItem,
    toggleSelectedEditMode,
    updateChecklistItem,
    updateNumberDraft,
    updateRequestNote,
    updateRequestTask,
    updateRequestTaskNote,
    updateSpecificationSection,
    selectedChecklistItem,
    activeOverviewTab,
    setActiveOverviewTab,
    scheduleJourneyMonths,
    scheduleJourneyRequests,
    scheduleRequests,
    newContext,
    setNewContext,
  } = useRequestsView(actor, {
    collectionId: collectionState.selectedCollectionId,
    collections: collectionState.collections,
  });
  const canManageCollections = hasPermission(actor, "demands.update");
  const canReorderRequests = hasPermission(actor, "demands.reorder");

  useEffect(() => {
    if (!initialTaskTarget?.requestId || !initialTaskTarget?.taskId) return;
    let active = true;
    setTaskToOpenId(initialTaskTarget.taskId);
    void selectRequest(initialTaskTarget.requestId).then(() => {
      if (!active) return;
      setActiveDetailTab("tasks");
      onInitialTaskTargetHandled?.();
    });
    return () => {
      active = false;
    };
  }, [initialTaskTarget?.requestId, initialTaskTarget?.taskId]);

  async function moveImprovementToCollection(requestId, collectionId) {
    const payload = await moveRequestToCollection(requestId, collectionId);
    if (payload.request) upsertRequestInList(payload.request);
    await Promise.all([loadRequests(), loadRequestCollectionItems()]);
    return payload;
  }

  function selectCollection(collectionId) {
    closeSelectedRequest();
    setRequestPage(1);
    collectionState.setSelectedCollectionId(collectionId);
  }

  return (
    <section className="requestsPage">
      <header className="requestsHero">
        <div>
          <h2>Projetos e Melhorias</h2>
        </div>
        <button
          className="primaryButton"
          disabled={savingRequestId === "new" || !catalog.applications.length}
          onClick={() => void addRequest()}
          type="button"
        >
          <Plus size={16} />
          Nova melhoria
        </button>
      </header>

      <RequestError
        collectionError={collectionError}
        requestError={requestError}
      />

      {!selectedRequest ? (
        <div className="requestCatalogFilters contentBand">
          {catalog.applications.length ? (
            <CatalogFilterFields
              applicationId={applicationFilter}
              applications={catalog.applications}
              componentId={componentFilter}
              components={catalog.components}
              onChange={(field, value) => {
                setRequestPage(1);
                if (field === "applicationId") setApplicationFilter(value);
                if (field === "componentId") setComponentFilter(value);
              }}
            />
          ) : null}
          <RequestStatusFilter
            onChange={(nextStatuses) => {
              setRequestPage(1);
              setStatusFilters(nextStatuses);
            }}
            value={statusFilters}
          />
        </div>
      ) : null}

      <ResourceCollectionsShell
        canDropRoot={(draggedItem) =>
          draggedItem.type === "collection" || canManageCollections
        }
        className="requestsCollectionsLayout"
        collections={collectionState.collections}
        detailVisible={Boolean(selectedRequest)}
        draggedItem={collectionState.draggedItem}
        initialNavigationWidth={400}
        onDropRoot={() =>
          collectionState.dropItem("", moveImprovementToCollection)
        }
        onNavigateBack={closeSelectedRequest}
        onSelectCollection={selectCollection}
        pathLabel={
          selectedRequest
            ? `${collectionPathLabel(
                collectionState.collections,
                selectedRequest.collectionId,
              )} / ${selectedRequest.title || "Sem título"}`
            : undefined
        }
        selectedCollectionId={collectionState.selectedCollectionId}
        navigator={
          <ResourceCollectionNavigator
            canDragItem={() =>
              canManageCollections ||
              (canReorderRequests && !statusFilters.length)
            }
            canDropOnCollection={(draggedItem) =>
              draggedItem.type === "collection" || canManageCollections
            }
            canReorderItem={() => canReorderRequests && !statusFilters.length}
            workspaceId={actor.workspaceId}
            className="requestCollectionsNavigator"
            collections={collectionState.collections}
            draggedItem={collectionState.draggedItem}
            getItemId={(request) => request.id}
            itemLabel="melhorias"
            items={requestCollectionItems}
            preferenceKey="demands"
            onCreate={
              canManageCollections
                ? collectionState.createCollection
                : undefined
            }
            onDelete={collectionState.removeCollection}
            onDragCollection={
              canManageCollections
                ? (collection) =>
                    collectionState.setDraggedItem({
                      type: "collection",
                      id: collection.id,
                    })
                : undefined
            }
            onDragEnd={() => collectionState.setDraggedItem(null)}
            onDragItem={(request) =>
              collectionState.setDraggedItem({
                type: "item",
                id: request.id,
                collectionId: request.collectionId || "",
              })
            }
            onDrop={(collectionId) =>
              collectionState.dropItem(
                collectionId,
                moveImprovementToCollection,
              )
            }
            onRename={(collection) =>
              collectionState.setCollectionDialog(collection)
            }
            onReorderItem={(requestId, targetRequest) =>
              void moveRequest(requestId, targetRequest.id)
            }
            onSelect={selectCollection}
            onSelectItem={(request) => {
              setRequestPage(1);
              collectionState.setSelectedCollectionId(
                request.collectionId || "",
              );
              void selectRequest(request.id);
            }}
            renderItem={(request) => (
              <span className="requestCollectionItem">
                <span className="requestCollectionItemHeader">
                  <strong>{request.clientCode || "Sem código"}</strong>
                  <span
                    className="requestStatusChip"
                    style={requestStatusStyle(request.status)}
                  >
                    {requestStatusLabel(request.status)}
                  </span>
                </span>
                <span className="requestCollectionItemDescription">
                  {request.title || "Sem título"}
                </span>
              </span>
            )}
            selectedCollectionId={collectionState.selectedCollectionId}
            selectedItemId={selectedRequestId}
          />
        }
        toolbar={
          <RequestPagination
            loadCollections={collectionState.loadCollections}
            loadRequestCollectionItems={loadRequestCollectionItems}
            loadRequests={loadRequests}
            loadSelectedRequest={loadSelectedRequest}
            loadingRequests={loadingRequests}
            requestMeta={requestMeta}
            setRequestPage={setRequestPage}
          />
        }
      >
        {selectedRequest ? (
          <RequestDetails
            activeTab={activeDetailTab}
            initialTaskId={taskToOpenId}
            journeyTotals={{
              executedTotal: selectedExecutedTotal,
              overExecutedTotal: selectedOverExecutedTotal,
              plannedTotal: selectedPlannedJourneyTotal,
              pendingTotal: selectedPendingTotal,
            }}
            isEditing={isEditing}
            onBeginNumberDraft={beginNumberDraft}
            onJourneyCommentChange={updateJourneyComment}
            onJourneyMonthCommit={commitJourneyMonth}
            onInitialTaskHandled={() => setTaskToOpenId("")}
            onCreateNote={addRequestNote}
            onCreateTask={addRequestTask}
            onCreateTaskNote={addRequestTaskNote}
            onAddSpecificationSection={addSpecificationSection}
            onAddMissingSpecificationSections={addMissingSpecificationSections}
            onClearNumberDraft={clearNumberDraft}
            onClose={closeSelectedRequest}
            onCloseChecklistDialog={closeChecklistDialog}
            onCommitEstimatedJourneys={commitEstimatedJourneys}
            onDelete={removeSelectedRequest}
            onDeleteNote={removeRequestNote}
            onDeleteTask={removeRequestTask}
            onDeleteTaskNote={removeRequestTaskNote}
            onFieldChange={updateSelectedField}
            onMoveSpecificationSection={moveSpecificationSection}
            onReadDraftedNumber={readDraftedNumber}
            onRequestUpdated={upsertRequestInList}
            onContextChange={({ applicationId, affectedComponentIds }) => {
              if (!selectedRequest) return;
              const nextRequest = normalizeRequest({
                ...selectedRequest,
                applicationId,
                affectedComponentIds,
              });
              updateRequest(selectedRequest.id, () => nextRequest);
              schedulePersistRequest(nextRequest);
            }}
            onRemoveSpecificationSection={removeSpecificationSection}
            onRemoveChecklistItem={removeChecklistItem}
            onTabChange={setActiveDetailTab}
            onToggleChecklistItem={toggleChecklistItem}
            onToggleEditMode={toggleSelectedEditMode}
            onUpdateChecklistItem={updateChecklistItem}
            onUpdateNumberDraft={updateNumberDraft}
            onUpdateNote={updateRequestNote}
            onUpdateTask={updateRequestTask}
            onUpdateTaskNote={updateRequestTaskNote}
            onUpdateSpecificationSection={updateSpecificationSection}
            request={selectedRequest}
            savingRequestId={savingRequestId}
            selectedChecklistItem={selectedChecklistItem}
            applications={catalog.applications}
            components={catalog.components}
          />
        ) : (
          <RequestsOverview
            activeTab={activeOverviewTab}
            collections={collectionState.collections}
            journeyMonths={scheduleJourneyMonths}
            journeyRequests={scheduleJourneyRequests}
            loading={loadingRequests}
            onSelectRequest={selectRequest}
            onTabChange={setActiveOverviewTab}
            scheduleRequests={scheduleRequests}
            taskRequests={filteredRequests}
          />
        )}
      </ResourceCollectionsShell>
      <RequestDialogs
        addRequest={addRequest}
        catalog={catalog}
        collectionState={collectionState}
        newContext={newContext}
        savingRequestId={savingRequestId}
        setNewContext={setNewContext}
      />
    </section>
  );
}
