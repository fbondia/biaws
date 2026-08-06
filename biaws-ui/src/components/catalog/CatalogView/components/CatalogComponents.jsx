import { Archive, ArrowLeft, Pencil } from "lucide-react";

import { hasPermission } from "../../../../permissions.js";

export function EntityTable({ actions, columns, empty, items, onOpen }) {
  if (!items.length)
    return <div className="emptyState catalogEmptyState">{empty}</div>;
  return (
    <div className="catalogTableWrap">
      <table className="catalogTable">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            {actions ? <th>Ações</th> : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render
                    ? column.render(item)
                    : item[column.key] || "-"}
                </td>
              ))}
              {actions ? (
                <td className="catalogTableActions">{actions(item, onOpen)}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Status({ value }) {
  return (
    <span className={`catalogStatus catalogStatus-${value || "unknown"}`}>
      {value || "unknown"}
    </span>
  );
}

export function HeaderActions({
  actor,
  application,
  onArchive,
  onBack,
  onEdit,
}) {
  return (
    <div className="catalogHeaderActions">
      <button
        className="secondaryButton catalogBackButton"
        onClick={onBack}
        type="button"
      >
        <ArrowLeft size={16} /> Voltar
      </button>
      {hasPermission(actor, "applications.update") ? (
        <button className="secondaryButton" onClick={onEdit} type="button">
          <Pencil size={16} /> Editar
        </button>
      ) : null}
      {hasPermission(actor, "applications.archive") &&
      application.status !== "archived" ? (
        <button className="dangerButton" onClick={onArchive} type="button">
          <Archive size={16} /> Arquivar
        </button>
      ) : null}
    </div>
  );
}
