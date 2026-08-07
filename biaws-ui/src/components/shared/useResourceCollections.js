import { useEffect, useState } from "react";

import {
  createResourceCollection,
  deleteResourceCollection,
  fetchResourceCollections,
  updateResourceCollection,
} from "../../api.js";

export function useResourceCollections(
  resourceType,
  { onError, onMoved } = {},
) {
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [draggedItem, setDraggedItem] = useState(null);
  const [collectionDialog, setCollectionDialog] = useState(null);

  async function loadCollections() {
    try {
      const payload = await fetchResourceCollections(resourceType);
      setCollections(payload.items || []);
    } catch (error) {
      onError?.(error.message);
    }
  }

  useEffect(() => {
    void loadCollections();
  }, [resourceType]);

  async function saveCollection(name) {
    if (collectionDialog?.id) {
      await updateResourceCollection(resourceType, collectionDialog.id, {
        name,
      });
    } else {
      await createResourceCollection(resourceType, {
        name,
        parentId: selectedCollectionId,
      });
    }
    await loadCollections();
  }

  async function createCollection(parentId, name) {
    try {
      const payload = await createResourceCollection(resourceType, {
        name,
        parentId,
      });
      await loadCollections();
      return payload.collection;
    } catch (error) {
      onError?.(error.message);
      throw error;
    }
  }

  async function removeCollection(collection) {
    if (!window.confirm(`Excluir a coleção “${collection.name}”?`)) return;
    try {
      await deleteResourceCollection(resourceType, collection.id);
      if (selectedCollectionId === collection.id) setSelectedCollectionId("");
      await loadCollections();
    } catch (error) {
      onError?.(error.message);
    }
  }

  async function dropItem(collectionId, moveItem) {
    if (!draggedItem) return;
    try {
      if (draggedItem.type === "collection") {
        await updateResourceCollection(resourceType, draggedItem.id, {
          parentId: collectionId,
        });
        await loadCollections();
      } else {
        await moveItem(draggedItem.id, collectionId);
        await onMoved?.();
      }
    } catch (error) {
      onError?.(error.message);
    } finally {
      setDraggedItem(null);
    }
  }

  return {
    collectionDialog,
    collections,
    createCollection,
    draggedItem,
    dropItem,
    loadCollections,
    removeCollection,
    saveCollection,
    selectedCollectionId,
    setCollectionDialog,
    setDraggedItem,
    setSelectedCollectionId,
  };
}
