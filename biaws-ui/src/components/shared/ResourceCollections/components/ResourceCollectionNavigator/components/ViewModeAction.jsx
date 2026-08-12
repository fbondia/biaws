import { Columns3, ListTree } from "lucide-react";

export function ViewModeAction({ navigator }) {
  const showColumns = navigator.viewMode === "tree";
  const label = showColumns
    ? "Visualizar coleções em colunas"
    : "Visualizar coleções em árvore";

  return (
    <button
      aria-label={label}
      className="iconButton"
      onClick={() => navigator.setViewMode(showColumns ? "columns" : "tree")}
      title={label}
      type="button"
    >
      {showColumns ? (
        <Columns3 aria-hidden="true" size={16} />
      ) : (
        <ListTree aria-hidden="true" size={16} />
      )}
    </button>
  );
}
