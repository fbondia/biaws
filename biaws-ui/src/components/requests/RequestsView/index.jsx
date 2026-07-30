import { CalendarDays, ClipboardList, ListChecks, Plus } from "lucide-react";
import { useState } from "react";

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

export function RequestsView({ actor }) {
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
    selectedBilledTotal,
    selectedOverbilledTotal,
    selectedPlannedBillingTotal,
    selectedUnbilledTotal,
    isEditing,
    beginNumberDraft,
    updateBillingComment,
    commitBillingMonth,
    addRequestNote,
    addRequestTask,
    addRequestTaskNote,
    addSpecificationSection,
    addMissingSpecificationSections,
    clearNumberDraft,
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
    scheduleBillingMonths,
    scheduleBillingRequests,
    scheduleRequests,
    newContext,
    setNewContext,
  } = useRequestsView(actor);
  return (
    <section className="requestsPage">
      <header className="requestsHero">
        <div>
          <h2>Projetos e Demandas</h2>
        </div>
        <button
          className="primaryButton"
          disabled={savingRequestId === "new" || !catalog.applications.length}
          onClick={() => void addRequest()}
          type="button"
        >
          <Plus size={16} />
          Nova demanda
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
          aria-label="Navegação de demandas"
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
            Demandas
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

        {selectedRequest ? (
          <RequestDetails
            activeTab={activeDetailTab}
            billingTotals={{
              billedTotal: selectedBilledTotal,
              overbilledTotal: selectedOverbilledTotal,
              plannedTotal: selectedPlannedBillingTotal,
              unbilledTotal: selectedUnbilledTotal,
            }}
            isEditing={isEditing}
            onBeginNumberDraft={beginNumberDraft}
            onBillingCommentChange={updateBillingComment}
            onBillingMonthCommit={commitBillingMonth}
            onCreateNote={addRequestNote}
            onCreateTask={addRequestTask}
            onCreateTaskNote={addRequestTaskNote}
            onAddSpecificationSection={addSpecificationSection}
            onAddMissingSpecificationSections={addMissingSpecificationSections}
            onClearNumberDraft={clearNumberDraft}
            onClose={closeSelectedRequest}
            onCloseChecklistDialog={() => setChecklistDialogLabel("")}
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
            billingMonths={scheduleBillingMonths}
            billingRequests={scheduleBillingRequests}
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
                <span>Nova demanda</span>
                <h2 id="new-demand-context-title">Defina o contexto</h2>
              </div>
            </header>
            <p>
              A demanda precisa pertencer a uma aplicação. Os componentes
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
                Criar demanda
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
            aria-label="Filtrar demandas por status"
            aria-modal="true"
            className="tagFilterDialog issueOptionFilterDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Filtrar demandas por status</strong>
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
