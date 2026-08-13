import { useEffect, useRef, useState } from "react";

import {
  archiveDocument,
  createDocument,
  deleteDocument,
  fetchDocument,
  fetchDocuments,
  fetchIssueTaxonomy,
  moveDocumentToCollection,
  restoreDocument,
  saveDocument,
} from "../../../../api.js";
import { hasPermission } from "../../../../permissions.js";
import { useMessages } from "../../../../infrastructure/messages/MessagesProvider.jsx";
import { useCatalogOptions } from "../../../catalog/CatalogContextFields/index.jsx";
import { useResourceCollections } from "../../../shared/useResourceCollections.js";
import { fetchAllDocumentPages } from "../../knowledgeModel.js";
import { documentPermissions, emptyDraft, normalizedDraft } from "../model.js";

export function useKnowledgeRecordsView(actor) {
  const { confirm } = useMessages();
  const permissions = documentPermissions(actor);
  const catalog = useCatalogOptions(
    hasPermission(actor, "applications.read") &&
      hasPermission(actor, "components.read"),
    actor.workspaceId,
  );
  const [items, setItems] = useState([]);
  const [organizationItems, setOrganizationItems] = useState([]);
  const [taxonomyPackage, setTaxonomyPackage] = useState(null);
  const [draft, setDraft] = useState(null);
  const [creating, setCreating] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [createType, setCreateType] = useState("");
  const [search, setSearch] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [componentFilter, setComponentFilter] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const loadVersionRef = useRef(0);
  const mountedRef = useRef(true);
  const collectionsState = useResourceCollections("documents", {
    onError: setError,
    onMoved: () => load(),
  });

  async function load(
    searchValue = search,
    applicationValue = applicationFilter,
    componentValue = componentFilter,
    typeValue = typeFilter,
    includeArchivedValue = includeArchived,
  ) {
    const loadVersion = loadVersionRef.current + 1;
    loadVersionRef.current = loadVersion;
    setLoading(true);
    setError("");
    try {
      const payload = await fetchAllDocumentPages(fetchDocuments, {
        search: searchValue,
        documentType: typeValue,
        applicationId: applicationValue,
        componentId: componentValue,
        includeArchived: includeArchivedValue,
      });
      if (!mountedRef.current || loadVersion !== loadVersionRef.current) return;
      const loaded = payload.items || [];
      setItems(loaded);
      const filtered = Boolean(
        searchValue || applicationValue || componentValue,
      );
      if (!filtered) setOrganizationItems(loaded);
      setSearchActive(filtered);
    } catch (loadError) {
      if (mountedRef.current && loadVersion === loadVersionRef.current) {
        setError(loadError.message);
      }
    } finally {
      if (mountedRef.current && loadVersion === loadVersionRef.current) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void load(
      search,
      applicationFilter,
      componentFilter,
      typeFilter,
      includeArchived,
    );
  }, [applicationFilter, componentFilter, includeArchived, typeFilter]);

  useEffect(() => {
    if (!hasPermission(actor, "taxonomy.read")) return;
    fetchIssueTaxonomy()
      .then((payload) => setTaxonomyPackage(payload.taxonomy || null))
      .catch(() => setTaxonomyPackage(null));
  }, [actor]);

  async function openRecord(record) {
    setError("");
    setCreating(false);
    try {
      const payload = await fetchDocument(record.id);
      setDraft(normalizedDraft(payload.document));
      collectionsState.setSelectedCollectionId(record.collectionId || "");
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function persist(nextDraft = draft) {
    setSaving(true);
    setError("");
    try {
      const payload = nextDraft.id
        ? await saveDocument(nextDraft.id, nextDraft)
        : await createDocument(nextDraft);
      setDraft(normalizedDraft(payload.document));
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function archive(record) {
    if (!(await confirm(`Arquivar “${record.title}”?`))) return;
    try {
      await archiveDocument(record.id);
      if (draft?.id === record.id) setDraft(null);
      await load();
    } catch (archiveError) {
      setError(archiveError.message);
    }
  }

  async function remove(record) {
    if (record.status !== "archived") return;
    if (
      !(await confirm({
        message: `Excluir definitivamente “${record.title}”? Esta ação não pode ser desfeita.`,
        tone: "danger",
      }))
    ) {
      return;
    }
    try {
      await deleteDocument(record.id);
      if (draft?.id === record.id) setDraft(null);
      await load();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function restore(record) {
    if (record.status !== "archived") return;
    if (!(await confirm(`Desarquivar “${record.title}”?`))) return;
    try {
      await restoreDocument(record.id);
      if (draft?.id === record.id) setDraft(null);
      await load();
    } catch (restoreError) {
      setError(restoreError.message);
    }
  }

  async function moveItem(id, collectionId) {
    await moveDocumentToCollection(id, collectionId);
    setOrganizationItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, collectionId } : item,
      ),
    );
  }

  function closeDetail() {
    setDraft(null);
    setCreating(false);
  }

  function selectCollection(collectionId) {
    closeDetail();
    collectionsState.setSelectedCollectionId(collectionId);
  }

  function selectTypeFilter(value) {
    closeDetail();
    setTypeFilter(value);
  }

  function startCreating() {
    setDraft(null);
    setCreateType("");
    setCreating(true);
  }

  function continueCreation(documentType) {
    setDraft(
      emptyDraft(
        documentType,
        searchActive ? "" : collectionsState.selectedCollectionId,
      ),
    );
    setCreating(false);
  }

  const visibleItems = searchActive
    ? items
    : items.filter(
        (item) =>
          (item.collectionId || "") === collectionsState.selectedCollectionId,
      );

  return {
    applicationFilter,
    archive,
    catalog,
    closeDetail,
    collectionsState,
    componentFilter,
    continueCreation,
    createType,
    creating,
    draft,
    error,
    includeArchived,
    load,
    loading,
    moveItem,
    openRecord,
    organizationItems,
    permissions,
    persist,
    remove,
    restore,
    saving,
    search,
    searchActive,
    selectCollection,
    selectTypeFilter,
    setApplicationFilter,
    setComponentFilter,
    setCreateType,
    setDraft,
    setIncludeArchived,
    setSearch,
    startCreating,
    taxonomyPackage,
    typeFilter,
    visibleItems,
  };
}
