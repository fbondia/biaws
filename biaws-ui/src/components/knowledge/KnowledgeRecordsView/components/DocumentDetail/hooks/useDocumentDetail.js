import { useEffect, useState } from "react";

import {
  addDocumentObservation,
  fetchDocumentObservations,
  fetchDocumentRevisions,
  fetchDocuments,
} from "../../../../../../api.js";
import { fetchAllDocumentPages } from "../../../../knowledgeModel.js";

export function useDocumentDetail(draft) {
  const [tab, setTab] = useState("overview");
  const [showDetails, setShowDetails] = useState(!draft.id);
  const [observations, setObservations] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [observationDraft, setObservationDraft] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [referenceOptions, setReferenceOptions] = useState([]);

  useEffect(() => {
    if (!draft.id) return;
    let active = true;
    Promise.all([
      fetchDocumentObservations(draft.id),
      fetchDocumentRevisions(draft.id),
    ])
      .then(([observationPayload, revisionPayload]) => {
        if (!active) return;
        setObservations(observationPayload.items || []);
        setRevisions(revisionPayload.items || []);
      })
      .catch(() => {
        if (active) {
          setObservations([]);
          setRevisions([]);
        }
      });
    return () => {
      active = false;
    };
  }, [draft.id, refreshKey]);

  useEffect(() => {
    let active = true;
    fetchAllDocumentPages(fetchDocuments)
      .then((payload) =>
        active
          ? setReferenceOptions(
              (payload.items || []).filter(({ id }) => id !== draft.id),
            )
          : undefined,
      )
      .catch(() => {
        if (active) setReferenceOptions([]);
      });
    return () => {
      active = false;
    };
  }, [draft.id]);

  async function addObservation() {
    await addDocumentObservation(draft.id, observationDraft);
    setObservationDraft("");
    setRefreshKey((value) => value + 1);
  }

  return {
    addObservation,
    observationDraft,
    observations,
    referenceOptions,
    refreshKey,
    revisions,
    setObservationDraft,
    setShowDetails,
    setTab,
    showDetails,
    tab,
  };
}
