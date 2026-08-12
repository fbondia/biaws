import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { collectionPathLabel, parentCollectionId } from "../model.js";
import { ResourceCollectionBarActionsProvider } from "./ResourceCollectionBarActionsContext.js";

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
  canDropRoot = () => true,
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
  const [collectionFilterTarget, setCollectionFilterTarget] = useState(null);
  const [resourceActionsTarget, setResourceActionsTarget] = useState(null);
  const [viewModeTarget, setViewModeTarget] = useState(null);
  const canNavigateBack = Boolean(detailVisible || selectedCollectionId);
  const displayedPathLabel =
    pathLabel ??
    (selectedCollectionId
      ? collectionPathLabel(collections, selectedCollectionId)
      : "");

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
    <ResourceCollectionBarActionsProvider
      value={{
        collectionFilterTarget,
        resourceActionsTarget,
        viewModeTarget,
      }}
    >

      <div
        className={[
          "resourceCollectionsLayout",
          className,
          detailVisible ? "resourceCollectionsDetailVisible" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >

        {/* BARRA DE FERRAMENTAS */}
        <div
          className={
            displayedPathLabel || canNavigateBack
              ? "resourceCollectionBar"
              : "resourceCollectionBar resourceCollectionBarAtRoot"
          }
        >
          
          {/* CONTROLES À ESQUERDA */}
          <div className="resourceCollectionBarPrimary">{toolbar}</div>
          
          {/* BOTÕES À DIREITA */}
          <div className="resourceCollectionBarUtilities">
            <div
              className="resourceCollectionBarActionSlot"
              ref={setCollectionFilterTarget}
            />
            <div
              className="resourceCollectionBarActionSlot"
              ref={setResourceActionsTarget}
            />
            <div
              className="resourceCollectionBarActionSlot"
              ref={setViewModeTarget}
            />
          </div>
        </div>

        
        {/* CORPO PRINCIPAL (LISTA + DETALHES) */}
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
              if (!event.currentTarget.hasPointerCapture(event.pointerId))
                return;
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
          <div className="resourceCollectionContent">

            {/* PATH DE NAVEGAÇÃO */}
            {(displayedPathLabel || canNavigateBack) &&
              <button
                className={[
                  "resourceCollectionPath",
                  displayedPathLabel || canNavigateBack
                    ? ""
                    : "resourceCollectionPathEmpty",
                  rootDropActive ? "resourceCollectionDropTarget" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={displayedPathLabel || "Raiz"}
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
                  if (!draggedItem || !onDropRoot || !canDropRoot(draggedItem))
                    return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setRootDropActive(true);
                }}
                onDrop={(event) => {
                  if (!draggedItem || !onDropRoot || !canDropRoot(draggedItem))
                    return;
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
                tabIndex={displayedPathLabel || canNavigateBack ? 0 : -1}
                type="button"
              >
                {canNavigateBack ? (
                  <ChevronLeft aria-hidden="true" size={15} />
                ) : null}
                <span className="resourceCollectionPathLabel">
                  {displayedPathLabel}
                </span>
              </button>
            }
  
            {/* CONTEÚDO */}
            {children}
          </div>
        </div>
      </div>
    </ResourceCollectionBarActionsProvider>
  );
}
