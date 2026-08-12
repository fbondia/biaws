import { useState } from "react";

import { collectionPathLabel } from "../../model.js";
import {
  ResourceCollectionBar,
  ResourceCollectionBarActionsProvider,
} from "../ResourceCollectionBar/index.jsx";
import { ResourceCollectionPath } from "./components/ResourceCollectionPath.jsx";
import { ResourceCollectionsResizer } from "./components/ResourceCollectionsResizer.jsx";
import { useNavigationResize } from "./hooks/useNavigationResize.js";
import { ResourceCollectionsShellProvider } from "./ResourceCollectionsShellContext.js";

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
  const resize = useNavigationResize(initialNavigationWidth);
  const [archivedItemsTarget, setArchivedItemsTarget] = useState(null);
  const [collectionFilterTarget, setCollectionFilterTarget] = useState(null);
  const [viewModeTarget, setViewModeTarget] = useState(null);
  const canNavigateBack = Boolean(detailVisible || selectedCollectionId);
  const displayedPathLabel =
    pathLabel ??
    (selectedCollectionId
      ? collectionPathLabel(collections, selectedCollectionId)
      : "");

  return (
    <ResourceCollectionsShellProvider
      value={{ canDropRoot, draggedItem, onDropRoot }}
    >
      <ResourceCollectionBarActionsProvider
        value={{
          archivedItemsTarget,
          collectionFilterTarget,
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
          <ResourceCollectionBar
            archivedItemsTargetRef={setArchivedItemsTarget}
            atRoot={!displayedPathLabel && !canNavigateBack}
            collectionFilterTargetRef={setCollectionFilterTarget}
            toolbar={toolbar}
            viewModeTargetRef={setViewModeTarget}
          />

          <div
            className="resourceCollectionsBody"
            ref={resize.bodyRef}
            style={{
              "--resource-collections-navigation-width": `${resize.navigationWidth}px`,
            }}
          >
            {navigator}
            <ResourceCollectionsResizer {...resize} />
            <div className="resourceCollectionContent">
              <ResourceCollectionPath
                canNavigateBack={canNavigateBack}
                collections={collections}
                detailVisible={detailVisible}
                displayedPathLabel={displayedPathLabel}
                onNavigateBack={onNavigateBack}
                onSelectCollection={onSelectCollection}
                selectedCollectionId={selectedCollectionId}
              />
              {children}
            </div>
          </div>
        </div>
      </ResourceCollectionBarActionsProvider>
    </ResourceCollectionsShellProvider>
  );
}
