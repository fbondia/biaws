import { ChevronLeft } from "lucide-react";

import { parentCollectionId } from "../../../model.js";
import { useRootCollectionDrop } from "../hooks/useRootCollectionDrop.js";

export function ResourceCollectionPath({
  canNavigateBack,
  collections,
  detailVisible,
  displayedPathLabel,
  onNavigateBack,
  onSelectCollection,
  selectedCollectionId,
}) {
  const rootDrop = useRootCollectionDrop();

  if (!displayedPathLabel && !canNavigateBack) return null;

  return (
    <button
      {...rootDrop.dropProps}
      aria-label={displayedPathLabel || "Raiz"}
      className={[
        "resourceCollectionPath",
        displayedPathLabel || canNavigateBack
          ? ""
          : "resourceCollectionPathEmpty",
        rootDrop.active ? "resourceCollectionDropTarget" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => {
        if (detailVisible) onNavigateBack?.();
        else if (selectedCollectionId) {
          onSelectCollection?.(
            parentCollectionId(collections, selectedCollectionId),
          );
        }
      }}
      title={
        detailVisible
          ? "Voltar à coleção"
          : selectedCollectionId
            ? "Voltar à coleção anterior"
            : "Raiz"
      }
      type="button"
    >
      {canNavigateBack ? <ChevronLeft aria-hidden="true" size={15} /> : null}
      <span className="resourceCollectionPathLabel">{displayedPathLabel}</span>
    </button>
  );
}
