import { createContext, useContext } from "react";

import { ResourceCollectionBarLeft } from "./components/Left.jsx";
import { ResourceCollectionBarRight } from "./components/Right.jsx";

const ResourceCollectionBarActionsContext = createContext(null);

export const ResourceCollectionBarActionsProvider =
  ResourceCollectionBarActionsContext.Provider;

export function useResourceCollectionBarActionTargets() {
  return useContext(ResourceCollectionBarActionsContext);
}

export function ResourceCollectionBar({
  atRoot = false,
  archivedItemsTargetRef,
  collectionFilterTargetRef,
  toolbar,
  viewModeTargetRef,
}) {
  return (
    <div
      className={
        atRoot
          ? "resourceCollectionBar resourceCollectionBarAtRoot"
          : "resourceCollectionBar"
      }
    >
      <ResourceCollectionBarLeft
        archivedItemsTargetRef={archivedItemsTargetRef}
        collectionFilterTargetRef={collectionFilterTargetRef}
        viewModeTargetRef={viewModeTargetRef}
      />
      <ResourceCollectionBarRight>{toolbar}</ResourceCollectionBarRight>
    </div>
  );
}
