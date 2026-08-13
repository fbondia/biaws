import { useEffect, useState } from "react";

import {
  fetchApplications,
  fetchComponents,
  fetchWorkspaces,
} from "../../../api.js";

export function useCatalogOptions(enabled = true, workspaceId = "") {
  const [workspace, setWorkspace] = useState(null);
  const [applications, setApplications] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    Promise.resolve()
      .then(async () => {
        const workspacePayload = await fetchWorkspaces();
        const operational =
          (workspacePayload.items || []).find(({ id }) => id === workspaceId) ||
          null;
        if (!operational) {
          return { operational, applications: [], components: [] };
        }
        const applicationPayload = await fetchApplications(operational.id, {
          limit: 100,
        });
        const applicationItems = applicationPayload.items || [];
        const componentGroups = await Promise.all(
          applicationItems.map(async (application) => ({
            applicationId: application.id,
            items:
              (await fetchComponents(application.id, { limit: 100 })).items ||
              [],
          })),
        );
        return {
          operational,
          applications: applicationItems,
          components: componentGroups.flatMap(({ items }) => items),
        };
      })
      .then((result) => {
        if (!active) return;
        setWorkspace(result.operational);
        setApplications(result.applications);
        setComponents(result.components);
        setError("");
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, workspaceId]);

  return { workspace, applications, components, loading, error };
}
