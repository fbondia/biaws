import { useCallback, useEffect, useRef, useState } from "react";

import { fetchRuntimeOptionLists } from "../../api/optionLists.js";
import { configureIssueConstants } from "../../constants/issues.js";
import { configureRequestConstants } from "../../data/requestConstants.js";
import { defaultLogger } from "../../infrastructure/logging/runtime.js";
import { useSession } from "../../infrastructure/session/SessionProvider.jsx";
import { SESSION_STATUS } from "../../infrastructure/session/service.js";
import { createRuntimeOptionListsLoader } from "../runtimeOptionLists.js";

export function useRuntimeOptionLists(actor) {
  const { status } = useSession();
  const [runtimeOptionsVersion, setRuntimeOptionsVersion] = useState(0);
  const [runtimeOptionsError, setRuntimeOptionsError] = useState("");
  const loaderRef = useRef(null);

  useEffect(() => {
    setRuntimeOptionsError("");
    if (status !== SESSION_STATUS.AUTHENTICATED || !actor.workspaceId) return undefined;

    const loader = createRuntimeOptionListsLoader({
      apply(optionLists) {
        configureRequestConstants(optionLists);
        configureIssueConstants(optionLists);
        setRuntimeOptionsError("");
        setRuntimeOptionsVersion((current) => current + 1);
      },
      load: fetchRuntimeOptionLists,
      onError(loadError) {
        setRuntimeOptionsError(
          "Não foi possível carregar as opções do workspace. Algumas opções podem estar indisponíveis.",
        );
        defaultLogger.warn("application.option_lists.load_failed", {
          context: { workspaceId: actor.workspaceId },
          error: loadError,
          message: "Runtime option lists could not be loaded",
        });
      },
    });
    loaderRef.current = loader;
    loader.load().catch(() => {});

    function retry() {
      loader.retry().catch(() => {});
    }
    window.addEventListener("online", retry);
    window.addEventListener("focus", retry);

    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("focus", retry);
      loader.dispose();
      if (loaderRef.current === loader) loaderRef.current = null;
    };
  }, [actor.workspaceId, actor.userId, actor.id, status]);

  const loadRuntimeOptionLists = useCallback(
    () => loaderRef.current?.load().catch(() => false) ?? Promise.resolve(false),
    [],
  );

  return { loadRuntimeOptionLists, runtimeOptionsError, runtimeOptionsVersion };
}
