import { Archive, ArchiveRestore } from "lucide-react";

export function ArchivedItemsAction({
  archivedItemsLabel,
  includeArchived,
  loading,
  onIncludeArchivedChange,
}) {
  if (!onIncludeArchivedChange) return null;

  const label = includeArchived
    ? `Ocultar ${archivedItemsLabel}`
    : `Mostrar ${archivedItemsLabel}`;

  return (
    <button
      aria-label={label}
      aria-pressed={Boolean(includeArchived)}
      className={
        includeArchived
          ? "iconButton activeCollectionNavigationToggle"
          : "iconButton"
      }
      disabled={loading}
      onClick={() => onIncludeArchivedChange(!includeArchived)}
      title={label}
      type="button"
    >
      {includeArchived ? (
        <ArchiveRestore aria-hidden="true" size={16} />
      ) : (
        <Archive aria-hidden="true" size={16} />
      )}
    </button>
  );
}
