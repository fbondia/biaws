import { CalendarDays, ClipboardList, ListChecks, Plus } from "lucide-react";
import { useRef, useState } from "react";

import {
  CatalogContextFields,
  CatalogFilterFields,
} from "../../catalog/CatalogContextFields.jsx";
import { FilterDialogButton } from "../../shared/FilterDialogButton.jsx";
import { RequestDetails } from "../RequestDetails.jsx";
import { RequestList } from "../RequestList.jsx";
import {
  normalizeRequest,
  requestStatusLabel,
  REQUEST_STATUS_OPTIONS,
} from "../requestUtils.js";
import { RequestsOverview } from "./components/RequestsOverview.jsx";
import { useRequestsView } from "./hooks/useRequestsView.js";

const REQUEST_LIST_MIN_WIDTH = 280;
const REQUEST_LIST_MAX_WIDTH = 720;
const REQUEST_CONTENT_MIN_WIDTH = 480;

export function RequestsView({ actor }) {
  const layoutRef = useRef(null);
  const [requestListWidth, setRequestListWidth] = useState(360);
  const [resizingRequestList, setResizingRequestList] = useState(false);
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
    activeMobileSection,
    setActiveMobileSection,
    statusFilters,
    filteredRequests,
    loadingRequests,
    moveRequest,
    requestMeta,
    loadRequests,
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
  } = useRequestsView(actor);

  function clampRequestListWidth(width) {
    const layoutWidth = layoutRef.current?.getBoundingClientRect().width;
    const availableWidth = layoutWidth
      ? layoutWidth - REQUEST_CONTENT_MIN_WIDTH - 8
      : REQUEST_LIST_MAX_WIDTH;
    const maximumWidth = Math.max(
      REQUEST_LIST_MIN_WIDTH,
      Math.min(REQUEST_LIST_MAX_WIDTH, availableWidth),
    );

    return Math.min(maximumWidth, Math.max(REQUEST_LIST_MIN_WIDTH, width));
  }

  function resizeRequestList(clientX) {
    const layoutLeft = layoutRef.current?.getBoundingClientRect().left;
    if (layoutLeft === undefined) return;
    setRequestListWidth(clampRequestListWidth(clientX - layoutLeft));
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

      {requestError ? (
        <div className="errorBox requestErrorBox">{requestError}</div>
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

      {!selectedRequest ? (
        <div
          className="requestsMobileTabs"
          role="tablist"
          aria-label="Navegação de melhorias"
        >
          <button
            aria-selected={activeMobileSection === "requests"}
            className={
              activeMobileSection === "requests"
                ? "detailTab activeDetailTab"
                : "detailTab"
            }
            onClick={() => setActiveMobileSection("requests")}
            role="tab"
            type="button"
          >
            <ClipboardList size={16} />
            Melhorias
          </button>
          <button
            aria-selected={activeMobileSection === "overview"}
            className={
              activeMobileSection === "overview"
                ? "detailTab activeDetailTab"
                : "detailTab"
            }
            onClick={() => setActiveMobileSection("overview")}
            role="tab"
            type="button"
          >
            <CalendarDays size={16} />
            Acompanhamento
          </button>
        </div>
      ) : null}

      <div
        className={[
          "requestsLayout",
          selectedRequest ? "requestDetailSelected" : "",
          activeMobileSection === "requests"
            ? "mobileRequestsList"
            : "mobileRequestsOverview",
        ]
          .filter(Boolean)
          .join(" ")}
        ref={layoutRef}
        style={{ "--request-list-width": `${requestListWidth}px` }}
      >
        <RequestList
          allowManualOrder={!statusFilters.length}
          filteredRequests={filteredRequests}
          hasActiveFilters={Boolean(
            applicationFilter || componentFilter || statusFilters.length,
          )}
          loadingRequests={loadingRequests}
          onMoveRequest={moveRequest}
          onNextPage={() =>
            setRequestPage((current) =>
              Math.min(requestMeta.totalPages, current + 1),
            )
          }
          onPreviousPage={() =>
            setRequestPage((current) => Math.max(1, current - 1))
          }
          onRefresh={() => loadRequests()}
          onSelectRequest={selectRequest}
          requestMeta={requestMeta}
          selectedRequestId={selectedRequestId}
        />

        <div
          aria-label="Redimensionar lista de melhorias"
          aria-orientation="vertical"
          aria-valuemax={REQUEST_LIST_MAX_WIDTH}
          aria-valuemin={REQUEST_LIST_MIN_WIDTH}
          aria-valuenow={requestListWidth}
          className={[
            "requestListResizer",
            resizingRequestList ? "requestListResizing" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onKeyDown={(event) => {
            let nextWidth;
            if (event.key === "ArrowLeft") nextWidth = requestListWidth - 20;
            if (event.key === "ArrowRight") nextWidth = requestListWidth + 20;
            if (event.key === "Home") nextWidth = REQUEST_LIST_MIN_WIDTH;
            if (event.key === "End") nextWidth = REQUEST_LIST_MAX_WIDTH;
            if (nextWidth === undefined) return;
            event.preventDefault();
            setRequestListWidth(clampRequestListWidth(nextWidth));
          }}
          onLostPointerCapture={() => setResizingRequestList(false)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setResizingRequestList(true);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            resizeRequestList(event.clientX);
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setResizingRequestList(false);
          }}
          role="separator"
          tabIndex={0}
          title="Arraste para redimensionar a lista de melhorias"
        />

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
            journeyMonths={scheduleJourneyMonths}
            journeyRequests={scheduleJourneyRequests}
            loading={loadingRequests}
            onSelectRequest={selectRequest}
            onTabChange={setActiveOverviewTab}
            scheduleRequests={scheduleRequests}
            taskRequests={filteredRequests}
          />
        )}
      </div>
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
