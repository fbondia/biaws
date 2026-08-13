import { GripVertical, Trash2, X } from "lucide-react";

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

export function OptionItemRow({
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

export function EmlDetectionTest({
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
