import { ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import { useState } from "react";

import {
  buildJourneyCollectionRows,
  formatMonth,
  journeyCollectionRowKey,
  visibleJourneyRows,
} from "./requestUtils.js";

function JourneyValues({ totals }) {
  return totals.planned || totals.executed ? (
    <>
      {totals.planned ? (
        <span className="requestBillingMatrixChip requestBillingMatrixChipPlanned">
          {totals.planned} previstas
        </span>
      ) : null}
      {totals.executed ? (
        <span className="requestBillingMatrixChip requestBillingMatrixChipBilled">
          {totals.executed} executadas
        </span>
      ) : null}
    </>
  ) : (
    <span className="requestBillingMatrixEmpty">-</span>
  );
}

export function JourneyCalendar({
  collections,
  months,
  requests,
  onSelectRequest,
}) {
  const [collapsedCollectionIds, setCollapsedCollectionIds] = useState(
    () => new Set(),
  );
  const rows = buildJourneyCollectionRows(collections, requests, months);
  const generalTotals = rows[0]?.totals || { planned: 0, executed: 0 };
  const collectionRowIds = rows
    .filter((row) => row.kind === "collection")
    .map(journeyCollectionRowKey);
  const hasCollapsedCollections = collectionRowIds.some((rowId) =>
    collapsedCollectionIds.has(rowId),
  );
  const allCollectionsCollapsed = collectionRowIds.every((rowId) =>
    collapsedCollectionIds.has(rowId),
  );
  const visibleRows = visibleJourneyRows(rows, collapsedCollectionIds);

  function toggleCollection(row) {
    const rowId = journeyCollectionRowKey(row);
    setCollapsedCollectionIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  return (
    <div className="requestScheduleBlock">
      <div className="sectionTitleRow">
        <h3>Calendário de jornadas</h3>
        <div className="requestJourneyCalendarSummary">
          <span>
            {requests.length} melhorias · {months.length} meses ·{" "}
            {generalTotals.planned} previstas · {generalTotals.executed}{" "}
            executadas
          </span>
          {collectionRowIds.length ? (
            <div
              className="requestJourneyCollectionActions"
              aria-label="Exibição das coleções"
            >
              <button
                disabled={!hasCollapsedCollections}
                onClick={() => setCollapsedCollectionIds(new Set())}
                type="button"
              >
                Expandir tudo
              </button>
              <button
                disabled={allCollectionsCollapsed}
                onClick={() =>
                  setCollapsedCollectionIds(new Set(collectionRowIds))
                }
                type="button"
              >
                Contrair tudo
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {requests.length && months.length ? (
        <div className="requestBillingMatrixWrap">
          <div
            className="requestBillingMatrix"
            style={{ "--billing-month-count": months.length + 1 }}
          >
            <div className="requestBillingMatrixHeader requestBillingMatrixDemandHeader">
              Melhoria ou coleção
            </div>
            {months.map((month) => (
              <div className="requestBillingMatrixHeader" key={month}>
                {formatMonth(month)}
              </div>
            ))}
            <div className="requestBillingMatrixHeader">Total</div>

            {visibleRows.flatMap((row) => {
              const rowKey =
                row.kind === "collection"
                  ? `collection:${row.id || "root"}`
                  : `request:${row.request.id}`;
              const label =
                row.kind === "collection" ? (
                  <button
                    aria-expanded={
                      !collapsedCollectionIds.has(journeyCollectionRowKey(row))
                    }
                    className="requestBillingMatrixCollection"
                    key={`${rowKey}:label`}
                    onClick={() => toggleCollection(row)}
                    style={{ "--billing-row-depth": row.depth }}
                    type="button"
                  >
                    {collapsedCollectionIds.has(
                      journeyCollectionRowKey(row),
                    ) ? (
                      <ChevronRight aria-hidden="true" size={14} />
                    ) : (
                      <ChevronDown aria-hidden="true" size={14} />
                    )}
                    <FolderTree aria-hidden="true" size={14} />
                    <strong>{row.name}</strong>
                    <span>{row.itemCount}</span>
                  </button>
                ) : (
                  <button
                    className="requestBillingMatrixDemand"
                    key={`${rowKey}:label`}
                    onClick={() => onSelectRequest(row.request.id)}
                    style={{ "--billing-row-depth": row.depth }}
                    type="button"
                  >
                    <strong>{row.request.title || "Sem título"}</strong>
                  </button>
                );
              const cellClass =
                row.kind === "collection"
                  ? "requestBillingMatrixCell requestBillingMatrixCollectionCell"
                  : "requestBillingMatrixCell";

              return [
                label,
                ...months.map((month) => (
                  <div className={cellClass} key={`${rowKey}:${month}`}>
                    <JourneyValues totals={row.totals.months[month]} />
                  </div>
                )),
                <div
                  className={`${cellClass} requestBillingMatrixTotalCell`}
                  key={`${rowKey}:total`}
                >
                  <JourneyValues totals={row.totals} />
                </div>,
              ];
            })}
          </div>
        </div>
      ) : (
        <div className="emptyState compactEmpty">
          Nenhuma jornada prevista ou executada.
        </div>
      )}
    </div>
  );
}
