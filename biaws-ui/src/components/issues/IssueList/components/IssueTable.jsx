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
    <div className="tableWrap">
      <table className="issueTable">
        <thead>
          <tr>
            {SORTABLE_COLUMNS.map(([field, label]) => (
              <SortableHeader
                field={field}
                key={field}
                label={label}
                loading={loading}
                onSort={onSort}
                sort={sort}
              />
            ))}
            <th>Aplicação</th>
            <th>Assuntos</th>
            <th>Tags</th>
            <th>Texto</th>
          </tr>
        </thead>
        <tbody>
          {items.map((issue) => (
            <IssueTableRow
              {...rowProps}
              issue={issue}
              key={issue.id || issue._id}
              loading={loading}
            />
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
  );
}

function SortableHeader({ field, label, loading, onSort, sort }) {
  const activeField = sort.startsWith("-") ? sort.slice(1) : sort;
  const active = activeField === field;
  const descending = active && sort.startsWith("-");
  const Icon = active ? (descending ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <th
      className="sortableTableHeader"
      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
    >
      <button
        className={
          active
            ? "sortableColumnHeader activeSortableColumnHeader"
            : "sortableColumnHeader"
        }
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
