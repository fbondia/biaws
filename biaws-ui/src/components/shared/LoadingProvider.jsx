import { LoaderCircle } from "lucide-react";
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import {
  getLoadingSnapshot,
  runWithGlobalLoading,
  startGlobalLoading,
  subscribeToLoading,
} from "../../loadingStore.js";

const LoadingContext = createContext(null);

export function LoadingProvider({ children }) {
  const operations = useSyncExternalStore(
    subscribeToLoading,
    getLoadingSnapshot,
    getLoadingSnapshot,
  );

  const value = useMemo(
    () => ({
      isLoading: operations.length > 0,
      loadingCount: operations.length,
      runWithLoading: runWithGlobalLoading,
      startLoading: startGlobalLoading,
    }),
    [operations.length],
  );

  const activeLabel =
    operations.reduce(
      (selected, operation) =>
        !selected || operation.priority >= selected.priority
          ? operation
          : selected,
      null,
    )?.label || "Carregando…";

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {operations.length ? (
        <div
          aria-live="polite"
          aria-label={activeLabel}
          aria-busy="true"
          className="globalLoading"
        >
          <div className="globalLoadingIndicator" role="status">
            <LoaderCircle
              aria-hidden="true"
              className="globalLoadingSpinner"
              size={22}
            />
            <span>{activeLabel}</span>
          </div>
        </div>
      ) : null}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoading must be used inside LoadingProvider");
  }
  return context;
}
