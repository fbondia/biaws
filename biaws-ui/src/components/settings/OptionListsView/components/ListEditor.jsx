import {
  AlertTriangle,
  GripVertical,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";

import { updateOptionList } from "../../../../api.js";
import {
  clone,
  COLOR_LIST_KEYS,
  detectEmlIssueType,
  EML_DETECTION_LIST_KEY,
  newItem,
  removeItem,
} from "../model.js";

const OPTION_COLORS = ["foreground", "background", "border"];

function OptionColorFields({ canManage, index, item, onUpdate }) {
  return (
    <td className="optionColorFields">
      {OPTION_COLORS.map((color) => (
        <label key={color} title={color}>
          <input
            disabled={!canManage}
            onChange={(event) => onUpdate(index, color, event.target.value)}
            type="color"
            value={item.metadata?.[color] || "#ffffff"}
          />
        </label>
      ))}
    </td>
  );
}

function OptionEmlFields({ canManage, index, item, onUpdate }) {
  return (
    <td className="optionEmlDetectionFields">
      <label>
        <input
          checked={item.metadata?.emlImport?.enabled !== false}
          disabled={!canManage}
          onChange={(event) => onUpdate(index, "enabled", event.target.checked)}
          type="checkbox"
        />
        Detectar automaticamente
      </label>
      <textarea
        aria-label={`Expressões de detecção de ${item.label || item.value}`}
        disabled={!canManage}
        onChange={(event) =>
          onUpdate(index, "subjectPatterns", event.target.value.split("\n"))
        }
        placeholder={String.raw`\b(?<code>INC\d{5,})\b`}
        rows={3}
        value={(item.metadata?.emlImport?.subjectPatterns || []).join("\n")}
      />
      <small>
        Uma expressão por linha. Use <code>{"(?<code>...)"}</code> para coletar
        o código.
      </small>
    </td>
  );
}

function OptionActiveCell({ canManage, index, item, onUpdate }) {
  if (item._new)
    return (
      <td>
        <span>-</span>
      </td>
    );
  return (
    <td>
      <button
        className={
          item.active ? "optionActiveButton active" : "optionActiveButton"
        }
        disabled={!canManage}
        onClick={() => onUpdate(index, "active", !item.active)}
        title={item.active ? "Desativar opção" : "Ativar opção"}
        type="button"
      >
        {item.active ? (
          "Sim"
        ) : (
          <>
            <X size={14} /> Não
          </>
        )}
      </button>
    </td>
  );
}

function OptionItemRow({
  canManage,
  dragged,
  dropTarget,
  hasColors,
  hasEmlDetection,
  index,
  isOnlyItem,
  item,
  onDragEnd,
  onDragOver,
  onDragStart,
  onDrop,
  onMove,
  onRemove,
  onUpdateColor,
  onUpdateEml,
  onUpdateItem,
}) {
  function moveWithKeyboard(event) {
    if (!canManage || !["ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    onMove(index, event.key === "ArrowUp" ? index - 1 : index + 1);
  }
  return (
    <tr
      className={[
        dragged ? "draggingOptionItem" : "",
        dropTarget ? "dropTargetOptionItem" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onDragOver={(event) => onDragOver(event, index)}
      onDrop={(event) => onDrop(event, index)}
    >
      <td className="optionDragColumn">
        <span
          aria-label={`Arrastar ${item.label || item.value || "nova opção"} para reordenar`}
          aria-keyshortcuts={canManage ? "ArrowUp ArrowDown" : undefined}
          className={
            canManage ? "optionDragHandle" : "optionDragHandle disabled"
          }
          draggable={canManage}
          onDragEnd={onDragEnd}
          onDragStart={(event) => onDragStart(event, index)}
          onKeyDown={moveWithKeyboard}
          role="button"
          tabIndex={canManage ? 0 : -1}
          title="Arraste ou use as setas para alterar a ordem"
        >
          <GripVertical size={17} />
        </span>
      </td>
      <td>
        <input
          disabled={!canManage || !item._new}
          onChange={(event) => onUpdateItem(index, "value", event.target.value)}
          value={item.value}
        />
      </td>
      <td>
        <input
          disabled={!canManage}
          onChange={(event) => onUpdateItem(index, "label", event.target.value)}
          value={item.label}
        />
      </td>
      {hasColors ? (
        <OptionColorFields
          canManage={canManage}
          index={index}
          item={item}
          onUpdate={onUpdateColor}
        />
      ) : null}
      {hasEmlDetection ? (
        <OptionEmlFields
          canManage={canManage}
          index={index}
          item={item}
          onUpdate={onUpdateEml}
        />
      ) : null}
      <OptionActiveCell
        canManage={canManage}
        index={index}
        item={item}
        onUpdate={onUpdateItem}
      />
      <td>
        {canManage ? (
          <button
            aria-label={`Excluir ${item.label || item.value || "opção"}`}
            className="iconButton dangerIconButton"
            disabled={isOnlyItem}
            onClick={() => onRemove(index)}
            title={
              isOnlyItem
                ? "A lista precisa ter ao menos uma opção"
                : "Excluir opção"
            }
            type="button"
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </td>
    </tr>
  );
}

function EmlDetectionTest({
  defaultLabel,
  detectionTest,
  onChange,
  testSubject,
}) {
  let message = `Nenhuma regra encontrada · será usado o tipo padrão “${defaultLabel}” e um código sintético.`;
  if (detectionTest?.error) message = detectionTest.error;
  else if (detectionTest)
    message = `Tipo: ${detectionTest.label}${detectionTest.code ? ` · Código: ${detectionTest.code}` : " · Código não coletado"}`;
  return (
    <section className="optionEmlDetectionTest">
      <label className="field">
        <span>Testar assunto de e-mail</span>
        <input
          onChange={onChange}
          placeholder="Ex.: RE: INC12345 - falha no acesso"
          type="text"
          value={testSubject}
        />
      </label>
      {testSubject ? (
        <div
          className={
            detectionTest?.error
              ? "optionDetectionResult error"
              : "optionDetectionResult"
          }
        >
          {message}
        </div>
      ) : null}
    </section>
  );
}

export function ListEditor({ list, canManage, onSaved }) {
  const [draft, setDraft] = useState(() => clone(list));
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropTargetIndex, setDropTargetIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [testSubject, setTestSubject] = useState("");
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
  );
}
