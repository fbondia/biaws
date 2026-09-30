import { ChevronDown, ChevronRight, FolderTree } from "lucide-react";
import { useId, useState } from "react";

import {
  buildJourneyCollectionRows,
  formatMonth,
  journeyCollectionRowKey,
  visibleJourneyRows,
} from "../requestUtils.js";
import { filterJourneyCalendar, normalizeJourneyMonthCount } from "./model.js";
import { JourneyBalanceBar } from "./components/JourneyBalanceBar.jsx";

export function JourneyCalendar({ collections, months, requests, onSelectRequest, currentDate = new Date() }) {
  const filterHelpId = useId();
  const [monthsBefore, setMonthsBefore] = useState("");
  const [monthsAfter, setMonthsAfter] = useState("");
  const [onlyUnbalanced, setOnlyUnbalanced] = useState(false);
  const [collapsedCollectionIds, setCollapsedCollectionIds] = useState(() => new Set());
  const filtered = filterJourneyCalendar({
    requests,
    months,
    monthsBefore,
    monthsAfter,
    onlyUnbalanced,
    currentDate,
  });
  const rows = buildJourneyCollectionRows(collections, filtered.requests, filtered.months);
  const generalTotals = rows[0]?.totals || { planned: 0, executed: 0 };
  const collectionRowIds = rows.filter((row) => row.kind === "collection").map(journeyCollectionRowKey);
  const hasCollapsedCollections = collectionRowIds.some((rowId) => collapsedCollectionIds.has(rowId));
  const allCollectionsCollapsed = collectionRowIds.every((rowId) => collapsedCollectionIds.has(rowId));
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
            {filtered.requests.length} {filtered.requests.length === 1 ? "melhoria" : "melhorias"} ·{" "}
            {filtered.months.length} {filtered.months.length === 1 ? "mês" : "meses"} · {generalTotals.planned}{" "}
            previstas · {generalTotals.executed} executadas
          </span>
          {collectionRowIds.length ? (
            <div className="requestJourneyCollectionActions" aria-label="Exibição das coleções">
              <button
                disabled={!hasCollapsedCollections}
                onClick={() => setCollapsedCollectionIds(new Set())}
                type="button"
              >
                Expandir tudo
              </button>
              <button
                disabled={allCollectionsCollapsed}
                onClick={() => setCollapsedCollectionIds(new Set(collectionRowIds))}
                type="button"
              >
                Contrair tudo
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="requestJourneyCalendarFilters">
        <label className="field requestJourneyMonthFilter">
          <span>Meses para trás</span>
          <input
            aria-describedby={filterHelpId}
            min="0"
            onChange={(event) => setMonthsBefore(normalizeJourneyMonthCount(event.target.value))}
            placeholder="Sem limite"
            step="1"
            type="number"
            value={monthsBefore}
          />
        </label>
        <label className="field requestJourneyMonthFilter">
          <span>Meses para frente</span>
          <input
            aria-describedby={filterHelpId}
            min="0"
            onChange={(event) => setMonthsAfter(normalizeJourneyMonthCount(event.target.value))}
            placeholder="Sem limite"
            step="1"
            type="number"
            value={monthsAfter}
          />
        </label>
        <label className="requestJourneyBalanceFilter">
          <input
            aria-describedby={filterHelpId}
            checked={onlyUnbalanced}
            onChange={(event) => setOnlyUnbalanced(event.target.checked)}
            type="checkbox"
          />
          Apenas melhorias desbalanceadas
        </label>
        <button
          className="secondaryButton"
          disabled={monthsBefore === "" && monthsAfter === "" && !onlyUnbalanced}
          onClick={() => {
            setMonthsBefore("");
            setMonthsAfter("");
            setOnlyUnbalanced(false);
          }}
          type="button"
        >
          Limpar filtros
        </button>
      </div>
      <p className="requestJourneyCalendarFilterHelp" id={filterHelpId}>
        Período relativo ao mês atual, incluindo-o. Campos vazios não limitam o período. O desbalanceamento compara o
        total previsto e executado de toda a melhoria; os totais exibidos consideram apenas o período selecionado.
      </p>

      <div className="requestJourneyBalanceLegend" aria-label="Legenda do balanceamento de jornadas">
        <span>
          <i aria-hidden="true" className="requestJourneyBalanceBalanced" />
          Previstas e executadas
        </span>
        <span>
          <i aria-hidden="true" className="requestJourneyBalancePending" />
          Previstas pendentes
        </span>
        <span>
          <i aria-hidden="true" className="requestJourneyBalanceExcess" />
          Executadas além do previsto
        </span>
        <span>Valores: executadas / previstas · proporção por célula</span>
      </div>

      {filtered.requests.length && filtered.months.length ? (
        <div className="requestBillingMatrixWrap">
          <div className="requestBillingMatrix" style={{ "--billing-month-count": filtered.months.length + 1 }}>
            <div className="requestBillingMatrixHeader requestBillingMatrixDemandHeader">Melhoria ou coleção</div>
            {filtered.months.map((month) => (
              <div className="requestBillingMatrixHeader" key={month}>
                {formatMonth(month)}
              </div>
            ))}
            <div className="requestBillingMatrixHeader">Total</div>

            {visibleRows.flatMap((row) => {
              const rowKey = row.kind === "collection" ? `collection:${row.id || "root"}` : `request:${row.request.id}`;
              const showJourneyValues =
                row.kind !== "collection" || collapsedCollectionIds.has(journeyCollectionRowKey(row));
              const label =
                row.kind === "collection" ? (
                  <button
                    aria-expanded={!collapsedCollectionIds.has(journeyCollectionRowKey(row))}
                    className="requestBillingMatrixCollection"
                    key={`${rowKey}:label`}
                    onClick={() => toggleCollection(row)}
                    style={{ "--billing-row-depth": row.depth }}
                    type="button"
                  >
                    {collapsedCollectionIds.has(journeyCollectionRowKey(row)) ? (
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
                ...filtered.months.map((month) => (
                  <div className={cellClass} key={`${rowKey}:${month}`}>
                    {showJourneyValues ? <JourneyBalanceBar totals={row.totals.months[month]} /> : null}
                  </div>
                )),
                <div className={`${cellClass} requestBillingMatrixTotalCell`} key={`${rowKey}:total`}>
                  {showJourneyValues ? <JourneyBalanceBar totals={row.totals} /> : null}
                </div>,
              ];
            })}
          </div>
        </div>
      ) : (
        <div className="emptyState compactEmpty">
          Nenhuma melhoria com jornadas previstas ou executadas corresponde aos filtros selecionados.
        </div>
      )}
    </div>
  );
}
