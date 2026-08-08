import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { collectionPathLabel, parentCollectionId } from "../model.js";

const COLLECTION_NAVIGATION_MIN_WIDTH = 260;
const COLLECTION_NAVIGATION_MAX_WIDTH = 600;
const COLLECTION_DETAIL_MIN_WIDTH = 420;

export function ResourceCollectionsShell({
  children,
  className = "",
  collections,
  detailVisible = false,
  draggedItem,
  initialNavigationWidth = 340,
  onDropRoot,
  onNavigateBack,
  onSelectCollection,
  pathLabel,
  selectedCollectionId,
  navigator,
  toolbar,
}) {
  const bodyRef = useRef(null);
  const [navigationWidth, setNavigationWidth] = useState(
    initialNavigationWidth,
  );
  const [resizingNavigation, setResizingNavigation] = useState(false);
  const [rootDropActive, setRootDropActive] = useState(false);
  const canNavigateBack = Boolean(detailVisible || selectedCollectionId);

  function clampNavigationWidth(width) {
    const bodyWidth = bodyRef.current?.getBoundingClientRect().width;
    const availableWidth = bodyWidth
      ? bodyWidth - COLLECTION_DETAIL_MIN_WIDTH - 8
      : COLLECTION_NAVIGATION_MAX_WIDTH;
    const maximumWidth = Math.max(
      COLLECTION_NAVIGATION_MIN_WIDTH,
      Math.min(COLLECTION_NAVIGATION_MAX_WIDTH, availableWidth),
    );
    return Math.min(
      maximumWidth,
      Math.max(COLLECTION_NAVIGATION_MIN_WIDTH, width),
    );
  }

  function resizeNavigation(clientX) {
    const bodyLeft = bodyRef.current?.getBoundingClientRect().left;
    if (bodyLeft === undefined) return;
    setNavigationWidth(clampNavigationWidth(clientX - bodyLeft));
  }

  useEffect(() => {
    if (!draggedItem) setRootDropActive(false);
  }, [draggedItem]);

  return (
    <div
      className={[
        "resourceCollectionsLayout",
        className,
        detailVisible ? "resourceCollectionsDetailVisible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="resourceCollectionBar">
        <button
          className={[
            "resourceCollectionPath",
            rootDropActive ? "resourceCollectionDropTarget" : "",
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
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setRootDropActive(false);
            }
          }}
          onDragOver={(event) => {
            if (!draggedItem || !onDropRoot) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setRootDropActive(true);
          }}
          onDrop={(event) => {
            if (!draggedItem || !onDropRoot) return;
            event.preventDefault();
            setRootDropActive(false);
            onDropRoot();
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
          {canNavigateBack ? (
            <ChevronLeft aria-hidden="true" size={15} />
          ) : null}
          {pathLabel || collectionPathLabel(collections, selectedCollectionId)}
        </button>
        {toolbar}
      </div>
      <div
        className="resourceCollectionsBody"
        ref={bodyRef}
        style={{
          "--resource-collections-navigation-width": `${navigationWidth}px`,
        }}
      >
        {navigator}
        <div
          aria-label="Redimensionar área de navegação"
          aria-orientation="vertical"
          aria-valuemax={COLLECTION_NAVIGATION_MAX_WIDTH}
          aria-valuemin={COLLECTION_NAVIGATION_MIN_WIDTH}
          aria-valuenow={navigationWidth}
          className={[
            "resourceCollectionsResizer",
            resizingNavigation ? "resourceCollectionsResizing" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onKeyDown={(event) => {
            let nextWidth;
            if (event.key === "ArrowLeft") nextWidth = navigationWidth - 20;
            if (event.key === "ArrowRight") nextWidth = navigationWidth + 20;
            if (event.key === "Home") {
              nextWidth = COLLECTION_NAVIGATION_MIN_WIDTH;
            }
            if (event.key === "End") {
              nextWidth = COLLECTION_NAVIGATION_MAX_WIDTH;
            }
            if (nextWidth === undefined) return;
            event.preventDefault();
            setNavigationWidth(clampNavigationWidth(nextWidth));
          }}
          onLostPointerCapture={() => setResizingNavigation(false)}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            setResizingNavigation(true);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
            resizeNavigation(event.clientX);
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            setResizingNavigation(false);
          }}
          role="separator"
          tabIndex={0}
          title="Arraste para redimensionar a área de navegação"
        />
        <div className="resourceCollectionContent">{children}</div>
      </div>
    </div>
  );
}
