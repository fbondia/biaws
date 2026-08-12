import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

import { defaultSessionService } from "./runtime.js";

const SessionContext = createContext(null);

export function SessionProvider({ children, service = defaultSessionService }) {
  const state = useSyncExternalStore(
    service.subscribe,
    service.getState,
    service.getState,
  );

  const value = useMemo(
    () => ({
      ...state,
      refresh: service.refresh,
      signIn: service.signIn,
      signOut: service.signOut,
      switchWorkspace: service.switchWorkspace,
    }),
    [service, state],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return session;
}
