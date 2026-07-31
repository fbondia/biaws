import { useEffect, useMemo, useRef, useState } from "react";

import { fetchIssueTaxonomy, saveIssueTaxonomy } from "../../../../api.js";
import {
  appendChild,
  cloneCatalog,
  downloadJsonFile,
  editableCatalog,
  EMPTY_CATALOG,
  exportFileName,
  findTreeNode,
  hasNode,
  removeNode,
  serializeCatalog,
  slugify,
  updateNode,
} from "../model.js";

function updateGroup(groups, selectedGroupId, update) {
  return groups.map((group) =>
    group.id === selectedGroupId ? update(group) : group,
  );
}

function addSortedTag(group, tagId) {
  if (group.tags.includes(tagId)) return group;
  return {
    ...group,
    tags: [...group.tags, tagId].sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

function withoutTag(group, tagId) {
  return { ...group, tags: group.tags.filter((tag) => tag !== tagId) };
}

export function useIssueTaxonomyManager() {
  const uploadInputRef = useRef(null);
  const [catalog, setCatalog] = useState(() =>
    editableCatalog(cloneCatalog(EMPTY_CATALOG)),
  );
  const [persistedSnapshot, setPersistedSnapshot] = useState("");
  const [applications, setApplications] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState(
    catalog.tagGroups[0]?.id || "",
  );
  const [selectedNodeId, setSelectedNodeId] = useState(
    catalog.taxonomy[0]?.id || "",
  );
  const [activeDefinitionTab, setActiveDefinitionTab] =
    useState("classification");
  const [newTag, setNewTag] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedGroup = catalog.tagGroups.find(
    (group) => group.id === selectedGroupId,
  );
  const exportPayload = useMemo(() => editableCatalog(catalog), [catalog]);
  const hasPendingChanges = serializeCatalog(catalog) !== persistedSnapshot;

  function applyCatalog(nextCatalog) {
    const editable = editableCatalog(cloneCatalog(nextCatalog));
    setCatalog(editable);
    setSelectedGroupId(editable.tagGroups[0]?.id || "");
    setSelectedNodeId(editable.taxonomy[0]?.id || "");
    setNewTag("");
    setAddingTag(false);
  }

  async function loadTaxonomy() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = await fetchIssueTaxonomy();
      const nextCatalog = editableCatalog(payload.taxonomy);
      setApplications(payload.applications || []);
      applyCatalog(nextCatalog);
      setPersistedSnapshot(serializeCatalog(nextCatalog));
      setMessage("");
    } catch (loadError) {
      const nextCatalog = editableCatalog(EMPTY_CATALOG);
      applyCatalog(nextCatalog);
      setPersistedSnapshot(serializeCatalog(nextCatalog));
      setMessage(
        "Taxonomia não encontrada na base de dados. Envie um arquivo JSON para iniciar o rascunho.",
      );

      if (!String(loadError.message || "").includes("not found")) {
        setError(loadError.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTaxonomy();
  }, []);

  function updateSelectedGroup(field, value) {
    setCatalog((current) => ({
      ...current,
      tagGroups: updateGroup(current.tagGroups, selectedGroupId, (group) => ({
        ...group,
        [field]: value,
      })),
    }));
  }

  function addTag(event) {
    event.preventDefault();

    const id = slugify(newTag);
    if (!id || !selectedGroup || selectedGroup.tags.includes(id)) return;

    setCatalog((current) => ({
      ...current,
      tagGroups: updateGroup(current.tagGroups, selectedGroupId, (group) =>
        addSortedTag(group, id),
      ),
    }));
    setNewTag("");
    setAddingTag(false);
  }

  function openAddTagDialog() {
    setNewTag("");
    setAddingTag(true);
  }

  function closeAddTagDialog() {
    setNewTag("");
    setAddingTag(false);
  }

  function removeTag(tagId) {
    setCatalog((current) => ({
      ...current,
      tagGroups: updateGroup(current.tagGroups, selectedGroupId, (group) =>
        withoutTag(group, tagId),
      ),
    }));
  }

  function addNode(parentId, nodeLabel) {
    const label = nodeLabel.trim();
    const id = slugify(label);
    if (!id || hasNode(catalog.taxonomy, id)) return null;

    const parent = findTreeNode(catalog.taxonomy, parentId);
    const node = {
      id,
      label,
      applicationIds: [...(parent?.applicationIds || [])],
    };
    setCatalog((current) => ({
      ...current,
      taxonomy: appendChild(current.taxonomy, parentId, node),
    }));
    setSelectedNodeId(id);
    return node;
  }

  function editNode(nodeId, patch) {
    const trimmedLabel = String(patch?.label || "").trim();
    if (!trimmedLabel) return null;

    const applicationIds = [
      ...new Set(
        (patch?.applicationIds || [])
          .map((id) => String(id || "").trim())
          .filter(Boolean),
      ),
    ];

    setCatalog((current) => ({
      ...current,
      taxonomy: updateNode(current.taxonomy, nodeId, {
        label: trimmedLabel,
        applicationIds,
      }),
    }));
    setSelectedNodeId(nodeId);
    return { id: nodeId, label: trimmedLabel, applicationIds };
  }

  function deleteNode(nodeId) {
    if (!nodeId) return false;

    setCatalog((current) => ({
      ...current,
      taxonomy: removeNode(current.taxonomy, nodeId),
    }));
    setSelectedNodeId("");
    return true;
  }

  async function uploadTaxonomyFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setMessage("");

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const nextCatalog = editableCatalog(
        parsed.taxonomy && !parsed.tagGroups ? parsed.taxonomy : parsed,
      );

      applyCatalog({
        ...nextCatalog,
        source: {
          ...(nextCatalog.source || {}),
          uploadedFileName: file.name,
        },
      });
      setMessage(
        "Arquivo carregado no rascunho. Clique em Gravar alterações para enviar ao banco de dados.",
      );
    } catch (uploadError) {
      setError(`Não foi possível carregar o arquivo: ${uploadError.message}`);
    } finally {
      event.target.value = "";
    }
  }

  function openUploadDialog() {
    uploadInputRef.current?.click();
    setError("");
  }

  function downloadTaxonomyFile() {
    downloadJsonFile(exportPayload, exportFileName(catalog));
    setError("");
    setMessage("Arquivo JSON gerado para download a partir do rascunho atual.");
  }

  async function saveCatalog() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = await saveIssueTaxonomy(exportPayload);
      const nextCatalog = editableCatalog(payload.taxonomy);
      applyCatalog(nextCatalog);
      setPersistedSnapshot(serializeCatalog(nextCatalog));
      setMessage("Taxonomia gravada no banco de dados.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return {
    uploadInputRef,
    catalog,
    applications,
    selectedGroupId,
    setSelectedGroupId,
    selectedNodeId,
    setSelectedNodeId,
    activeDefinitionTab,
    setActiveDefinitionTab,
    newTag,
    setNewTag,
    addingTag,
    loading,
    saving,
    message,
    error,
    selectedGroup,
    hasPendingChanges,
    loadTaxonomy,
    updateSelectedGroup,
    addTag,
    openAddTagDialog,
    closeAddTagDialog,
    removeTag,
    addNode,
    editNode,
    deleteNode,
    uploadTaxonomyFile,
    openUploadDialog,
    downloadTaxonomyFile,
    saveCatalog,
  };
}
