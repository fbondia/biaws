import { createContext, useContext } from "react";

const ResourceCollectionsShellContext = createContext(null);

export const ResourceCollectionsShellProvider =
  ResourceCollectionsShellContext.Provider;

export function useResourceCollectionsShell() {
  return useContext(ResourceCollectionsShellContext);
}
