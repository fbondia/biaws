import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildCollectionColumns,
  buildCollectionTree,
  countItemsByCollection,
  groupItemsByCollection,
} from "../model.js";

export function useResourceCollectionNavigator({
  collections,
  items,
  onCreate,
  onDrop,
  onSelect,
  selectedCollectionId,
}) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const [dropTargetId, setDropTargetId] = useState(null);
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
  const childrenByParent = useMemo(
    () => buildCollectionTree(collections),
    [collections],
  );
  const itemCounts = useMemo(() => countItemsByCollection(items), [items]);
  const itemsByCollection = useMemo(
    () => groupItemsByCollection(collections, items),
    [collections, items],
  );
  const columnNavigation = useMemo(
    () =>
      buildCollectionColumns(
        collections,
        childrenByParent,
        selectedCollectionId,
      ),
    [childrenByParent, collections, selectedCollectionId],
  );

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
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  }

  function finishDrag(onDragEnd) {
    setDropTargetId(null);
    onDragEnd();
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
    itemsByCollection,
    setDropTargetId,
    setViewMode,
    toggleCollection,
    updateCollectionDraft,
    viewMode,
  };
}
