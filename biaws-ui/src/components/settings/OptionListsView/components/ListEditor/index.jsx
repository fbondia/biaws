import {
  AlertTriangle,
  CopyPlus,
  GripVertical,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import { replicateOptionList, updateOptionList } from "../../../../../api.js";
import { ReplicationDialog } from "../../../../shared/ReplicationDialog.jsx";
import {
  clone,
  COLOR_LIST_KEYS,
  detectEmlIssueType,
  EML_DETECTION_LIST_KEY,
  newItem,
  removeItem,
} from "../../model.js";
import {
  EmlDetectionTest,
  OptionItemRow,
} from "./components/ListEditorParts.jsx";

export function ListEditor({
  list,
  canManage,
  currentWorkspaceId,
  onSaved,
  workspaces,
}) {
  const [draft, setDraft] = useState(() => clone(list));
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testSubject, setTestSubject] = useState("");
  const [replicationOpen, setReplicationOpen] = useState(false);
  const hasColors = COLOR_LIST_KEYS.has(list.key);
  const hasEmlDetection = list.key === EML_DETECTION_LIST_KEY;
  const detectionTest = testSubject
    ? detectEmlIssueType(testSubject, draft.items)
    : null;

  function updateItem(index, field, value) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value,
              ...(item._new && field === "value" && !item.label
                ? { label: value }
                : {}),
            }
          : item,
      ),
    }));
  }

  function updateColor(index, field, value) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, metadata: { ...item.metadata, [field]: value } }
          : item,
      ),
    }));
  }

  function updateEmlDetection(index, field, value) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              metadata: {
                ...item.metadata,
                emlImport: {
                  enabled: item.metadata?.emlImport?.enabled !== false,
                  subjectPatterns:
                    item.metadata?.emlImport?.subjectPatterns || [],
                  [field]: value,
                },
              },
            }
          : item,
      ),
    }));
  }

  function startDragging(event, index) {
    if (!canManage) return;
    setDraggedIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function dragOver(event, index) {
    if (!canManage || draggedIndex === null || draggedIndex === index) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetIndex(index);
  }

  function stopDragging() {
    setDraggedIndex(null);
    setDropTargetIndex(null);
  }

  function moveItem(sourceIndex, targetIndex) {
    if (
      !Number.isInteger(sourceIndex) ||
      !Number.isInteger(targetIndex) ||
      sourceIndex === targetIndex ||
      targetIndex < 0 ||
      targetIndex >= draft.items.length
    ) {
      return;
    }

    setDraft((current) => {
      const items = [...current.items];
      const [moved] = items.splice(sourceIndex, 1);
      items.splice(targetIndex, 0, moved);
      return {
        ...current,
        items: items.map((item, index) => ({
          ...item,
          order: (index + 1) * 10,
        })),
      };
    });
  }

  function dropItem(event, targetIndex) {
    event.preventDefault();
    const sourceIndex =
      draggedIndex ?? Number(event.dataTransfer.getData("text/plain"));
    moveItem(sourceIndex, targetIndex);
    stopDragging();
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...draft,
        items: draft.items.map(({ _new, ...item }) => ({
          ...item,
          ...(hasEmlDetection
            ? {
                metadata: {
                  ...item.metadata,
                  emlImport: {
                    enabled: item.metadata?.emlImport?.enabled !== false,
                    subjectPatterns: (
                      item.metadata?.emlImport?.subjectPatterns || []
                    )
                      .map((pattern) => pattern.trim())
                      .filter(Boolean),
                  },
                },
              }
            : {}),
        })),
      };
      const result = await updateOptionList(list.key, payload);
      setDraft(clone(result.optionList));
      onSaved(result.optionList);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="taxonomyPanel taxonomyTabPanel optionListCard">
        <header className="optionListHeader">
          {canManage ? (
            <button
              className="primaryButton"
              disabled={saving}
              onClick={save}
              type="button"
            >
              <Save size={16} />
              {saving ? "Salvando..." : "Salvar"}
            </button>
          ) : null}
          {workspaces.some(({ id }) => id !== currentWorkspaceId) ? (
            <button
              className="secondaryButton"
              onClick={() => setReplicationOpen(true)}
              type="button"
            >
              <CopyPlus size={16} /> Replicar
            </button>
          ) : null}
        </header>
        {error ? (
          <div className="optionListError">
            <AlertTriangle size={16} />
            {error}
          </div>
        ) : null}
        {draft.defaultValue ? (
          <label className="field optionListDefault">
            <span>Valor padrão</span>
            <select
              disabled={!canManage}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  defaultValue: event.target.value,
                }))
              }
              value={draft.defaultValue}
            >
              {draft.items
                .filter((item) => item.active)
                .map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        <div className="optionListTableWrap">
          <table className="optionListTable">
            <thead>
              <tr>
                <th aria-label="Ordem" className="optionDragColumn" />
                <th>Valor</th>
                <th>Rótulo</th>
                {hasColors ? <th>Cores</th> : null}
                {hasEmlDetection ? <th>Detecção no assunto do EML</th> : null}
                <th>Ativo</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {draft.items.map((item, index) => (
                <OptionItemRow
                  canManage={canManage}
                  dragged={draggedIndex === index}
                  dropTarget={dropTargetIndex === index}
                  hasColors={hasColors}
                  hasEmlDetection={hasEmlDetection}
                  index={index}
                  isOnlyItem={draft.items.length === 1}
                  item={item}
                  key={`${item.value}-${index}`}
                  onDragEnd={stopDragging}
                  onDragOver={dragOver}
                  onDragStart={startDragging}
                  onDrop={dropItem}
                  onMove={moveItem}
                  onRemove={(itemIndex) =>
                    setDraft((current) => removeItem(current, itemIndex))
                  }
                  onUpdateColor={updateColor}
                  onUpdateEml={updateEmlDetection}
                  onUpdateItem={updateItem}
                />
              ))}
            </tbody>
          </table>
        </div>
        {hasEmlDetection ? (
          <EmlDetectionTest
            defaultLabel={
              draft.items.find((item) => item.value === draft.defaultValue)
                ?.label || draft.defaultValue
            }
            detectionTest={detectionTest}
            onChange={(event) => setTestSubject(event.target.value)}
            testSubject={testSubject}
          />
        ) : null}
        {canManage ? (
          <button
            className="secondaryButton optionAddButton"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                items: [...current.items, newItem(current)],
              }))
            }
            type="button"
          >
            <Plus size={16} />
            Adicionar opção
          </button>
        ) : null}
      </section>
      <ReplicationDialog
        currentWorkspaceId={currentWorkspaceId}
        description={
          <p>
            A configuração completa substituirá a lista de mesma chave nos
            destinos, incluindo opções, ordem, valor padrão, cores e regras de
            detecção. Registros existentes não serão alterados.
          </p>
        }
        eyebrow={list.key}
        onClose={() => setReplicationOpen(false)}
        onReplicate={(destinationWorkspaceIds) =>
          replicateOptionList(list.key, destinationWorkspaceIds)
        }
        open={replicationOpen}
        resourceKey={list.key}
        title="Replicar lista de opções"
        workspaces={workspaces}
      />
    </>
  );
}
