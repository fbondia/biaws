import { FolderCheck, FolderSearch } from "lucide-react";

export function CollectionFilterAction({ navigator }) {
  const filterLabel = navigator.showOnlyPopulated
    ? "Mostrar todas as coleções"
    : "Ocultar coleções sem itens";

  return (
    <button
      aria-label={filterLabel}
      aria-pressed={navigator.showOnlyPopulated}
      className={
        navigator.showOnlyPopulated
          ? "iconButton activeCollectionNavigationToggle"
          : "iconButton"
      }
      onClick={() => navigator.setShowOnlyPopulated((current) => !current)}
      title={filterLabel}
      type="button"
    >
      {navigator.showOnlyPopulated ? (
        <FolderCheck aria-hidden="true" size={16} />
      ) : (
        <FolderSearch aria-hidden="true" size={16} />
      )}
    </button>
  );
}
