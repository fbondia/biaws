import { useEffect, useState } from "react";

import {
  createProcedureCollection,
  createProcedure,
  deleteProcedureCollection,
  deleteProcedure,
  fetchIssueTaxonomy,
  fetchProcedureCollections,
  fetchProcedures,
  moveProcedureToCollection,
  saveProcedureCollection,
  saveProcedure,
} from "../../../../api.js";
import { hasPermission } from "../../../../permissions.js";
import { useCatalogOptions } from "../../../catalog/CatalogContextFields.jsx";
import { normalizeDraft } from "../model.js";

export function useProceduresView(actor) {
  const [items, setItems] = useState([]);
  const [organizationItems, setOrganizationItems] = useState([]);
  const [collections, setCollections] = useState([]);
  const [search, setSearch] = useState("");
  const [taxonomyFilters, setTaxonomyFilters] = useState([]);
  const [tagFilters, setTagFilters] = useState({});
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [renamingCollection, setRenamingCollection] = useState(null);
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [taxonomyDialogOpen, setTaxonomyDialogOpen] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [draft, setDraft] = useState(null);
  const [taxonomyPackage, setTaxonomyPackage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [componentFilter, setComponentFilter] = useState("");
  const catalog = useCatalogOptions(
    hasPermission(actor, "applications.read") &&
      hasPermission(actor, "components.read"),
    actor.workspaceId,
  );

  const selectedTagCount = Object.values(tagFilters).reduce(
    (total, values) => total + values.length,
    0,
  );

  async function load(
    searchValue = search,
    taxonomyValues = taxonomyFilters,
    tagValues = tagFilters,
    applicationValue = applicationFilter,
    componentValue = componentFilter,
  ) {
    setLoading(true);
    setError("");
    try {
      const payload = await fetchProcedures({
        search: searchValue,
        applicationId: applicationValue,
        componentId: componentValue,
        taxonomy: taxonomyValues.join(","),
        ...Object.fromEntries(
          Object.entries(tagValues)
            .filter(([, values]) => values.length)
            .map(([groupId, values]) => [`tag_${groupId}`, values.join(",")]),
        ),
        limit: 100,
      });
      setItems(payload.items || []);
      const hasFilters = Boolean(
        String(searchValue || "").trim() ||
        taxonomyValues.length ||
        Object.values(tagValues).some((values) => values.length) ||
        applicationValue ||
        componentValue,
      );
      if (!hasFilters) setOrganizationItems(payload.items || []);
      setSearchActive(hasFilters);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCollections() {
    try {
      const payload = await fetchProcedureCollections();
      setCollections(payload.items || []);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    load("", [], {});
    loadCollections();
    fetchIssueTaxonomy()
      .then((payload) => setTaxonomyPackage(payload.taxonomy))
      .catch(() => setTaxonomyPackage(null));
  }, []);

  async function persist() {
    setSaving(true);
    setError("");
    try {
      const payload = draft.id
        ? await saveProcedure(draft.id, draft)
        : await createProcedure(draft);
      setOrganizationItems((current) => {
        const exists = current.some(({ id }) => id === payload.procedure.id);
        return exists
          ? current.map((item) =>
              item.id === payload.procedure.id ? payload.procedure : item,
            )
          : [...current, payload.procedure];
      });
      setDraft(null);
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  function applyPersistedProcedure(procedure) {
    setItems((current) =>
      current.map((item) => (item.id === procedure.id ? procedure : item)),
    );
  }

  async function remove(procedure) {
    if (!window.confirm(`Excluir o procedimento “${procedure.title}”?`)) return;
    try {
      await deleteProcedure(procedure.id);
      setOrganizationItems((current) =>
        current.filter(({ id }) => id !== procedure.id),
      );
      await load();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function clearFilters() {
    setSearch("");
    setTaxonomyFilters([]);
    setTagFilters({});
    setApplicationFilter("");
    setComponentFilter("");
    load("", [], {}, "", "");
  }

  function toggleFilterTag(groupId, tagId) {
    setTagFilters((current) => {
      const selected = current[groupId] || [];
      return {
        ...current,
        [groupId]: selected.includes(tagId)
          ? selected.filter((item) => item !== tagId)
          : [...selected, tagId],
      };
    });
  }

  async function createCollection(parentId, name) {
    const payload = await createProcedureCollection({
      name,
      parentId,
    });
    setCollections((current) => [...current, payload.collection]);
    setSelectedCollectionId(payload.collection.id);
    return payload.collection;
  }

  async function renameCollection(name) {
    if (!renamingCollection) return;
    const payload = await saveProcedureCollection(renamingCollection.id, {
      name,
    });
    setCollections((current) =>
      current.map((collection) =>
        collection.id === renamingCollection.id
          ? payload.collection
          : collection,
      ),
    );
  }

  async function removeCollection(collection) {
    if (!window.confirm(`Excluir a coleção vazia “${collection.name}”?`))
      return;
    try {
      setError("");
      await deleteProcedureCollection(collection.id);
      setCollections((current) =>
        current.filter(({ id }) => id !== collection.id),
      );
      if (selectedCollectionId === collection.id) {
        setSelectedCollectionId(collection.parentId || "");
      }
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  async function moveDraggedItem(collectionId) {
    if (!draggedItem) return;

    try {
      setError("");
      if (draggedItem.type === "procedure") {
        if ((draggedItem.collectionId || "") === collectionId) return;
        const payload = await moveProcedureToCollection(
          draggedItem.id,
          collectionId,
        );
        setItems((current) =>
          current.map((item) =>
            item.id === draggedItem.id ? payload.procedure : item,
          ),
        );
        setOrganizationItems((current) =>
          current.map((item) =>
            item.id === draggedItem.id ? payload.procedure : item,
          ),
        );
      } else if (draggedItem.type === "collection") {
        if ((draggedItem.parentId || "") === collectionId) return;
        const payload = await saveProcedureCollection(draggedItem.id, {
          parentId: collectionId,
        });
        setCollections((current) =>
          current.map((collection) =>
            collection.id === draggedItem.id ? payload.collection : collection,
          ),
        );
      }
    } catch (moveError) {
      setError(moveError.message);
    } finally {
      setDraggedItem(null);
    }
  }

  const visibleItems = searchActive
    ? items
    : items.filter(
        (item) => (item.collectionId || "") === selectedCollectionId,
      );

  return {
    organizationItems,
    collections,
    search,
    setSearch,
    taxonomyFilters,
    setTaxonomyFilters,
    tagFilters,
    selectedCollectionId,
    setSelectedCollectionId,
    searchActive,
    filtersVisible,
    setFiltersVisible,
    renamingCollection,
    setRenamingCollection,
    tagsDialogOpen,
    setTagsDialogOpen,
    taxonomyDialogOpen,
    setTaxonomyDialogOpen,
    draggedItem,
    setDraggedItem,
    draft,
    setDraft,
    taxonomyPackage,
    loading,
    saving,
    error,
    applicationFilter,
    setApplicationFilter,
    componentFilter,
    setComponentFilter,
    catalog,
    selectedTagCount,
    load,
    persist,
    applyPersistedProcedure,
    remove,
    clearFilters,
    toggleFilterTag,
    createCollection,
    renameCollection,
    removeCollection,
    moveDraggedItem,
    visibleItems,
  };
}
