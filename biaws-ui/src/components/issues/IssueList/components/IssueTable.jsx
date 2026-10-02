import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { IssueTableRow } from "./IssueTableRow.jsx";

const SORTABLE_COLUMNS = [
  ["id", "Código"],
  ["type", "Tipo"],
  ["status", "Status"],
  ["date", "Data"],
  ["title", "Título"],
];

export function IssueTable({ items, loading, onSort, sort, ...rowProps }) {
  return (
    <>
      <div className="issueMobileSort">
        <label className="field">
          <span>Ordenar por</span>
          <select disabled={loading} onChange={(event) => onSort(event.target.value)} value={sort.replace(/^-/, "")}>
            {SORTABLE_COLUMNS.map(([field, label]) => (
              <option key={field} value={field}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          aria-label={
            sort.startsWith("-") ? "Ordenação decrescente. Usar crescente" : "Ordenação crescente. Usar decrescente"
          }
          className="iconButton"
          disabled={loading}
          onClick={() => onSort(sort.replace(/^-/, ""))}
          type="button"
        >
          {sort.startsWith("-") ? <ArrowDown size={18} /> : <ArrowUp size={18} />}
        </button>
      </div>
      <div className="tableWrap">
        <table className="issueTable">
          <thead>
            <tr>
              {SORTABLE_COLUMNS.map(([field, label]) => (
                <SortableHeader field={field} key={field} label={label} loading={loading} onSort={onSort} sort={sort} />
              ))}
              <th>Aplicação</th>
              <th>Assuntos</th>
              <th>Tags</th>
              <th>Texto</th>
            </tr>
          </thead>
          <tbody>
            {items.map((issue) => (
              <IssueTableRow {...rowProps} issue={issue} key={issue.id || issue._id} loading={loading} />
            ))}
            {!loading && items.length === 0 ? (
              <tr>
                <td className="emptyTable" colSpan="9">
                  Nenhuma issue encontrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SortableHeader({ field, label, loading, onSort, sort }) {
  const activeField = sort.startsWith("-") ? sort.slice(1) : sort;
  const active = activeField === field;
  const descending = active && sort.startsWith("-");
  const Icon = active ? (descending ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <th className="sortableTableHeader" aria-sort={active ? (descending ? "descending" : "ascending") : "none"}>
      <button
        className={active ? "sortableColumnHeader activeSortableColumnHeader" : "sortableColumnHeader"}
        disabled={loading}
        onClick={() => onSort(field)}
        title={`Ordenar por ${label.toLowerCase()}`}
        type="button"
      >
        {label}
        <Icon aria-hidden="true" size={14} />
      </button>
    </th>
  );
}
