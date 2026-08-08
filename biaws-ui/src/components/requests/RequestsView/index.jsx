import {
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

import { moveRequestToCollection } from "../../../api.js";
import { hasPermission } from "../../../permissions.js";
import {
  CatalogContextFields,
  CatalogFilterFields,
} from "../../catalog/CatalogContextFields.jsx";
import { FilterDialogButton } from "../../shared/FilterDialogButton.jsx";
import {
  collectionPathLabel,
  ResourceCollectionDialog,
  ResourceCollectionNavigator,
  ResourceCollectionsShell,
} from "../../shared/ResourceCollections/index.jsx";
import { useResourceCollections } from "../../shared/useResourceCollections.js";
import { RequestDetails } from "../RequestDetails.jsx";
import {
  normalizeRequest,
  requestStatusLabel,
  requestStatusStyle,
  REQUEST_STATUS_OPTIONS,
} from "../requestUtils.js";
import { RequestsOverview } from "./components/RequestsOverview.jsx";
import { useRequestsView } from "./hooks/useRequestsView.js";

export function RequestsView({ actor }) {
  const [collectionError, setCollectionError] = useState("");
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
    requestMeta,
    requestCollectionItems,
    loadRequests,
    loadRequestCollectionItems,
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

      {requestError || collectionError ? (
        <div className="errorBox requestErrorBox">
          {requestError || collectionError}
        </div>
      ) : null}

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
            canDragItem={() => canManageCollections}
            className="requestCollectionsNavigator"
            collections={collectionState.collections}
            draggedItem={collectionState.draggedItem}
            getItemId={(request) => request.id}
            itemLabel="melhorias"
            items={requestCollectionItems}
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
          <div className="requestCollectionPagination">
            <span>
              {requestMeta.total} melhoria(s) · página {requestMeta.page} de{" "}
              {requestMeta.totalPages}
            </span>
            <button
              className="iconButton"
              disabled={loadingRequests || requestMeta.page <= 1}
              onClick={() =>
                setRequestPage((current) => Math.max(1, current - 1))
              }
              title="Página anterior"
              type="button"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="iconButton"
              disabled={
                loadingRequests || requestMeta.page >= requestMeta.totalPages
              }
              onClick={() =>
                setRequestPage((current) =>
                  Math.min(requestMeta.totalPages, current + 1),
                )
              }
              title="Próxima página"
              type="button"
            >
              <ChevronRight size={16} />
            </button>
            <button
              className="iconButton"
              disabled={loadingRequests}
              onClick={() =>
                void Promise.all([
                  loadRequests(),
                  loadRequestCollectionItems(),
                  collectionState.loadCollections(),
                ])
              }
              title="Atualizar melhorias"
              type="button"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        }
      >
        {selectedRequest ? (
          <RequestDetails
            activeTab={activeDetailTab}
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
      {newContext ? (
        <div
          className="dialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNewContext(null);
          }}
        >
          <section
            aria-labelledby="new-demand-context-title"
            aria-modal="true"
            className="catalogContextDialog"
            role="dialog"
          >
            <header>
              <div>
                <span>Nova melhoria</span>
                <h2 id="new-demand-context-title">Defina o contexto</h2>
              </div>
            </header>
            <p>
              A melhoria precisa pertencer a uma aplicação. Os componentes
              afetados podem ser definidos agora ou depois.
            </p>
            <CatalogContextFields
              affectedComponentIds={newContext.affectedComponentIds}
              applicationId={newContext.applicationId}
              applications={catalog.applications}
              components={catalog.components}
              onChange={setNewContext}
            />
            <footer>
              <button
                className="secondaryButton"
                onClick={() => setNewContext(null)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primaryButton"
                disabled={
                  !newContext.applicationId || savingRequestId === "new"
                }
                onClick={() => void addRequest(newContext)}
                type="button"
              >
                Criar melhoria
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      {collectionState.collectionDialog ? (
        <ResourceCollectionDialog
          collection={
            collectionState.collectionDialog.id
              ? collectionState.collectionDialog
              : null
          }
          onClose={() => collectionState.setCollectionDialog(null)}
          onSave={collectionState.saveCollection}
          parentLabel={collectionPathLabel(
            collectionState.collections,
            collectionState.selectedCollectionId,
          )}
          resourceLabel="melhorias"
        />
      ) : null}
    </section>
  );
}

function RequestStatusFilter({ onChange, value }) {
  const [open, setOpen] = useState(false);
  const summary =
    value.length === 1
      ? requestStatusLabel(value[0])
      : value.length
        ? `${value.length} selecionados`
        : "Todos os status";

  function toggleStatus(status) {
    onChange(
      value.includes(status)
        ? value.filter((item) => item !== status)
        : [...value, status],
    );
  }

  return (
    <>
      <FilterDialogButton
        count={value.length}
        icon={ListChecks}
        label="Status"
        onClick={() => setOpen(true)}
        summary={summary}
      />
      {open ? (
        <div
          className="tagFilterDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            aria-label="Filtrar melhorias por status"
            aria-modal="true"
            className="tagFilterDialog issueOptionFilterDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Filtrar melhorias por status</strong>
                <span>
                  Selecione um ou mais status para restringir os resultados.
                </span>
              </div>
              {value.length ? (
                <small>{value.length} selecionado(s)</small>
              ) : null}
            </header>
            <div className="tagFilterGroups issueOptionFilterDialogContent">
              <div className="tagFilterOptions">
                {REQUEST_STATUS_OPTIONS.map((status) => (
                  <label
                    className={
                      value.includes(status)
                        ? "tagFilterOption selectedTagFilterOption"
                        : "tagFilterOption"
                    }
                    key={status}
                  >
                    <input
                      checked={value.includes(status)}
                      onChange={() => toggleStatus(status)}
                      type="checkbox"
                    />
                    <span>{requestStatusLabel(status)}</span>
                  </label>
                ))}
              </div>
            </div>
            <footer>
              {value.length ? (
                <button
                  className="secondaryButton clearDialogSelectionButton"
                  onClick={() => onChange([])}
                  type="button"
                >
                  Limpar seleção
                </button>
              ) : null}
              <button
                className="primaryButton"
                data-dialog-close
                onClick={() => setOpen(false)}
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
