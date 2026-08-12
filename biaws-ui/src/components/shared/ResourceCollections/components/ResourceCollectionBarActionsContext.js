import { createContext, useContext } from "react";

const ResourceCollectionBarActionsContext = createContext(null);

export const ResourceCollectionBarActionsProvider =
  ResourceCollectionBarActionsContext.Provider;

export function useResourceCollectionBarActionTargets() {
  return useContext(ResourceCollectionBarActionsContext);
}
