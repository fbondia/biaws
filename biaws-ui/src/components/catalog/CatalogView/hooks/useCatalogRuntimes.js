import { useState } from "react";

import { fetchRuntimes } from "../../../../api.js";
import { hasPermission } from "../../../../permissions.js";

export function useCatalogRuntimes(actor) {
  const [runtimeByDeployment, setRuntimeByDeployment] = useState({});
  const [runtimeLoadingByDeployment, setRuntimeLoadingByDeployment] = useState(
    {},
  );
  const [runtimeErrorByDeployment, setRuntimeErrorByDeployment] = useState({});

  function resetRuntimes() {
    setRuntimeByDeployment({});
    setRuntimeLoadingByDeployment({});
    setRuntimeErrorByDeployment({});
  }

  async function loadRuntimes(deploymentId, { force = false } = {}) {
    if (
      !deploymentId ||
      !hasPermission(actor, "runtimes.read") ||
      runtimeLoadingByDeployment[deploymentId] ||
      (!force && Object.hasOwn(runtimeByDeployment, deploymentId))
    ) {
      return;
    }

    setRuntimeLoadingByDeployment((current) => ({
      ...current,
      [deploymentId]: true,
    }));
    setRuntimeErrorByDeployment((current) => ({
      ...current,
      [deploymentId]: "",
    }));
    try {
      const payload = await fetchRuntimes(deploymentId, {
        includeArchived: true,
        limit: 100,
      });
      setRuntimeByDeployment((current) => ({
        ...current,
        [deploymentId]: payload.items || [],
      }));
    } catch (loadError) {
      setRuntimeErrorByDeployment((current) => ({
        ...current,
        [deploymentId]: loadError.message,
      }));
    } finally {
      setRuntimeLoadingByDeployment((current) => ({
        ...current,
        [deploymentId]: false,
      }));
    }
  }

  return {
    loadRuntimes,
    resetRuntimes,
    runtimeByDeployment,
    runtimeErrorByDeployment,
    runtimeLoadingByDeployment,
  };
}
