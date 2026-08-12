import { useEffect, useMemo, useRef, useState } from "react";

import {
  fetchCollectionNavigationPreference,
  updateCollectionNavigationPreference,
} from "../../../../api/userPreferences.js";

import {
  buildCollectionColumns,
  buildCollectionTree,
  countItemsByCollection,
  groupItemsByCollection,
  populatedCollections,
} from "../model.js";

export function useResourceCollectionNavigator({
  collections,
  items,
  onCreate,
  onDrop,
  onSelect,
  preferenceKey,
  selectedCollectionId,
  workspaceId,
}) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const collapsedIdsRef = useRef(collapsedIds);
  const preferenceLoadVersionRef = useRef(0);
  const preferenceMutationQueuesRef = useRef(new Map());
  const preferenceMutationVersionsRef = useRef(new Map());
  const [dropTargetId, setDropTargetId] = useState(null);
  const [itemDropTargetId, setItemDropTargetId] = useState(null);
  const [showOnlyPopulated, setShowOnlyPopulated] = useState(false);
  const [viewMode, setViewMode] = useState(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 900px)").matches
      ? "columns"
      : "tree",
  );
  const [collectionDrafts, setCollectionDrafts] = useState({});
  const [creatingParentId, setCreatingParentId] = useState(null);
  const [creationError, setCreationError] = useState(null);
  const columnsRef = useRef(null);
  const visibleCollections = useMemo(
    () =>
      showOnlyPopulated
        ? populatedCollections(collections, items)
        : collections,
    [collections, items, showOnlyPopulated],
  );
  const childrenByParent = useMemo(
    () => buildCollectionTree(visibleCollections),
    [visibleCollections],
  );
  const itemCounts = useMemo(() => countItemsByCollection(items), [items]);
  const itemsByCollection = useMemo(
    () => groupItemsByCollection(visibleCollections, items),
    [items, visibleCollections],
  );
  const columnNavigation = useMemo(
    () =>
      buildCollectionColumns(
        visibleCollections,
        childrenByParent,
        selectedCollectionId,
      ),
    [childrenByParent, selectedCollectionId, visibleCollections],
  );

  useEffect(() => {
    if (
      showOnlyPopulated &&
      selectedCollectionId &&
      !visibleCollections.some(({ id }) => id === selectedCollectionId)
    ) {
      onSelect("");
    }
  }, [onSelect, selectedCollectionId, showOnlyPopulated, visibleCollections]);

  useEffect(() => {
    const loadVersion = preferenceLoadVersionRef.current + 1;
    preferenceLoadVersionRef.current = loadVersion;
    preferenceMutationVersionsRef.current.clear();
    const empty = new Set();
    collapsedIdsRef.current = empty;
    setCollapsedIds(empty);
    if (!preferenceKey) return undefined;

    let active = true;
    fetchCollectionNavigationPreference(preferenceKey)
      .then((preference) => {
        if (
          !active ||
          preferenceLoadVersionRef.current !== loadVersion ||
          preferenceMutationVersionsRef.current.size
        ) {
          return;
        }
        const loaded = new Set(preference.collapsedCollectionIds || []);
        collapsedIdsRef.current = loaded;
        setCollapsedIds(loaded);
      })
      .catch((error) => {
        console.error("Não foi possível carregar o estado das coleções", error);
      });

    return () => {
      active = false;
    };
  }, [preferenceKey]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const adaptViewMode = ({ matches }) =>
      setViewMode(matches ? "columns" : "tree");
    media.addEventListener("change", adaptViewMode);
    return () => media.removeEventListener("change", adaptViewMode);
  }, []);

  useEffect(() => {
    if (viewMode !== "columns") return;
    const frame = requestAnimationFrame(() => {
      columnsRef.current?.scrollTo({
        behavior: "smooth",
        left: columnsRef.current.scrollWidth,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [columnNavigation.columns.length, selectedCollectionId, viewMode]);

  function dropAt(collectionId) {
    setDropTargetId(null);
    setItemDropTargetId(null);
    onDrop(collectionId);
  }

  async function createAt(event, parentId) {
    event.preventDefault();
    const name = (collectionDrafts[parentId] || "").trim();
    if (!name || !onCreate) return;

    setCreatingParentId(parentId);
    setCreationError(null);
    try {
      const collection = await onCreate(parentId, name);
      setCollectionDrafts((current) => ({ ...current, [parentId]: "" }));
      if (collection?.id) onSelect(collection.id);
      return collection;
    } catch (error) {
      setCreationError({ parentId, message: error.message });
      return null;
    } finally {
      setCreatingParentId(null);
    }
  }

  function updateCollectionDraft(parentId, name) {
    setCollectionDrafts((current) => ({ ...current, [parentId]: name }));
    if (creationError?.parentId === parentId) setCreationError(null);
  }

  function toggleCollection(collectionId) {
    const next = new Set(collapsedIdsRef.current);
    const collapsed = !next.has(collectionId);
    if (collapsed) next.add(collectionId);
    else next.delete(collectionId);
    collapsedIdsRef.current = next;
    setCollapsedIds(next);

    if (!preferenceKey) return;
    const mutationVersion =
      (preferenceMutationVersionsRef.current.get(collectionId) || 0) + 1;
    preferenceMutationVersionsRef.current.set(collectionId, mutationVersion);
    const previousMutation =
      preferenceMutationQueuesRef.current.get(collectionId) ||
      Promise.resolve();
    const mutation = previousMutation
      .catch(() => undefined)
      .then(() =>
        updateCollectionNavigationPreference(
          preferenceKey,
          collectionId,
          collapsed,
          workspaceId,
        ),
      );
    preferenceMutationQueuesRef.current.set(collectionId, mutation);
    mutation
      .catch((error) => {
        if (
          preferenceMutationVersionsRef.current.get(collectionId) !==
          mutationVersion
        ) {
          return;
        }
        const rolledBack = new Set(collapsedIdsRef.current);
        if (collapsed) rolledBack.delete(collectionId);
        else rolledBack.add(collectionId);
        collapsedIdsRef.current = rolledBack;
        setCollapsedIds(rolledBack);
        console.error("Não foi possível salvar o estado da coleção", error);
      })
      .finally(() => {
        if (
          preferenceMutationQueuesRef.current.get(collectionId) === mutation
        ) {
          preferenceMutationQueuesRef.current.delete(collectionId);
        }
      });
  }

  function finishDrag(onDragEnd) {
    setDropTargetId(null);
    setItemDropTargetId(null);
    onDragEnd?.();
  }

  return {
    collapsedIds,
    collectionDrafts,
    columnNavigation,
    columnsRef,
    createAt,
    creatingParentId,
    creationError,
    childrenByParent,
    dropAt,
    dropTargetId,
    finishDrag,
    itemCounts,
    itemDropTargetId,
    itemsByCollection,
    setItemDropTargetId,
    setDropTargetId,
    setShowOnlyPopulated,
    setViewMode,
    showOnlyPopulated,
    toggleCollection,
    updateCollectionDraft,
    viewMode,
  };
}
