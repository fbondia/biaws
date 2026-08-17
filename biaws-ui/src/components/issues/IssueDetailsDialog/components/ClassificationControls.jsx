import { Crown, AlertCircle, ClipboardList, Tags, X } from "lucide-react";

import {
  ALL_STATUS_OPTIONS,
  DEFAULT_TAG_GROUP_COLOR,
} from "../../../../constants/issues.js";

export {
  buildUniqueTaxonomyId,
  hasTaxonomyNode,
  slugifyTaxonomyNode as slugify,
} from "../../../taxonomy/nodeIds.js";

export const DETAIL_TABS = [
  { key: "description", label: "Descrição" },
  { key: "comments", label: "Comentários" },
  { key: "files", label: "Arquivos" },
  { key: "context", label: "Aplicação" },
  { key: "kb", label: "KB" },
  { key: "history", label: "Histórico" },
];

export const EMPTY_CLASSIFICATION = {
  primaryTaxonomyId: "",
  secondaryTaxonomyIds: [],
  summary: "",
  tags: {},
};

export const ISSUE_TYPE_ICONS = {
  incident: AlertCircle,
  request: ClipboardList,
};

export function optionLabel(options, value) {
  return (
    options.find((option) => option.value === value)?.label || value || "-"
  );
}

export function normalizeClassification(classification = {}) {
  return {
    primaryTaxonomyId: classification.primaryTaxonomyId || "",
    secondaryTaxonomyIds: Array.isArray(classification.secondaryTaxonomyIds)
      ? classification.secondaryTaxonomyIds
      : [],
    summary: classification.summary || "",
    tags:
      classification.tags &&
      typeof classification.tags === "object" &&
      !Array.isArray(classification.tags)
        ? classification.tags
        : {},
  };
}

export function flattenTaxonomy(nodes = [], depth = 0, path = []) {
  return nodes.flatMap((node) => {
    const currentPath = [...path, node.label];
    const current = {
      ...node,
      depth,
      path: currentPath,
    };

    return [
      current,
      ...flattenTaxonomy(node.children || [], depth + 1, currentPath),
    ];
  });
}

export function serializeClassification(classification) {
  return JSON.stringify(normalizeClassification(classification));
}

export function selectedTaxonomyIds(classification) {
  return [
    classification.primaryTaxonomyId,
    ...classification.secondaryTaxonomyIds,
  ].filter(Boolean);
}

export function buildTaxonomyById(flatTaxonomy) {
  return Object.fromEntries(flatTaxonomy.map((node) => [node.id, node]));
}

export function getTaxonomyDisplayValue(taxonomyById, taxonomyId) {
  if (!taxonomyId) return "Sem classificação";

  const node = taxonomyById[taxonomyId];
  return node?.path?.length ? node.path.join(" / ") : taxonomyId;
}

export function getTaxonomyChipLabel(taxonomyById, taxonomyId) {
  return getTaxonomyDisplayValue(taxonomyById, taxonomyId);
}

export function TaxonomySelectionChips({
  onClear,
  onRemove,
  primaryTaxonomyId,
  selectedTaxonomies,
  taxonomyById,
}) {
  if (!selectedTaxonomies.length) {
    return <></>;
  }

  return (
    <div
      className="classificationTaxonomyChips"
      aria-label="Assuntos selecionados"
    >
      {selectedTaxonomies.map((taxonomyId) => {
        const isPrimary = taxonomyId === primaryTaxonomyId;

        return (
          <span
            className={
              isPrimary
                ? "classificationTaxonomyChip primaryTaxonomyChip"
                : "classificationTaxonomyChip"
            }
            key={taxonomyId}
            title={getTaxonomyDisplayValue(taxonomyById, taxonomyId)}
          >
            {isPrimary ? (
              <Crown
                className="primaryTaxonomyIcon"
                size={13}
                aria-hidden="true"
              />
            ) : null}
            {getTaxonomyChipLabel(taxonomyById, taxonomyId)}
            <button
              aria-label={`Remover ${getTaxonomyChipLabel(taxonomyById, taxonomyId)}`}
              onClick={() => onRemove(taxonomyId)}
              title="Remover assunto"
              type="button"
            >
              <X size={13} />
            </button>
          </span>
        );
      })}
      <button
        className="classificationTaxonomyChip clearTaxonomyChip"
        onClick={onClear}
        type="button"
      >
        Limpar Tudo
      </button>
    </div>
  );
}

export function getSelectedTagEntries(classification, tagGroups = []) {
  const knownGroupIds = new Set(tagGroups.map((group) => group.id));
  const knownTags = tagGroups.flatMap((group) =>
    (classification.tags[group.id] || []).map((tagId) => ({
      color: group.color || DEFAULT_TAG_GROUP_COLOR,
      groupId: group.id,
      groupLabel: group.label,
      tagId,
    })),
  );

  const unknownTags = Object.entries(classification.tags)
    .filter(([groupId]) => !knownGroupIds.has(groupId))
    .flatMap(([groupId, tagIds]) =>
      (Array.isArray(tagIds) ? tagIds : []).map((tagId) => ({
        color: DEFAULT_TAG_GROUP_COLOR,
        groupId,
        groupLabel: groupId,
        tagId,
      })),
    );

  return [...knownTags, ...unknownTags];
}

export function TagSelectionChips({ onRemove, tags }) {
  if (!tags.length) return null;

  return (
    <div className="classificationTagChips" aria-label="Tags selecionadas">
      {tags.map((tag) => (
        <span
          className="classificationTagChip"
          key={`${tag.groupId}-${tag.tagId}`}
          style={{ borderColor: tag.color }}
          title={tag.groupLabel}
        >
          <span
            className="tagColorSwatch"
            style={{ backgroundColor: tag.color }}
          />
          {tag.tagId}
          <button
            aria-label={`Remover tag ${tag.tagId}`}
            onClick={() => onRemove(tag.groupId, tag.tagId)}
            title="Remover tag"
            type="button"
          >
            <X size={13} />
          </button>
        </span>
      ))}
    </div>
  );
}

export function TagGroupDialog({ group, onClose, onToggleTag, selectedTags }) {
  if (!group) return null;

  return (
    <div
      className="tagPickerBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        aria-label={`Selecionar tags de ${group.label}`}
        aria-modal="true"
        className="tagPickerDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>{group.label}</strong>
            {group.description ? <span>{group.description}</span> : null}
          </div>
          <button
            className="iconButton"
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={16} />
          </button>
        </header>

        {group.tags?.length ? (
          <div className="tagPickerGrid">
            {group.tags.map((tagId) => (
              <label className="checkItem compactCheckItem" key={tagId}>
                <input
                  checked={selectedTags.includes(tagId)}
                  onChange={() => onToggleTag(group.id, tagId)}
                  type="checkbox"
                />
                <span>{tagId}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="emptyState compactEmpty">
            Nenhuma tag cadastrada neste grupo.
          </div>
        )}
      </section>
    </div>
  );
}

export function appendTaxonomyNode(nodes = [], parentId, child) {
  if (!parentId) return [...nodes, child];

  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...(node.children || []), child],
      };
    }

    return {
      ...node,
      children: node.children?.length
        ? appendTaxonomyNode(node.children, parentId, child)
        : node.children,
    };
  });
}

export function updateTaxonomyNodeLabel(nodes = [], nodeId, patch) {
  const normalizedPatch =
    typeof patch === "string" ? { label: patch } : { ...(patch || {}) };
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        ...normalizedPatch,
      };
    }

    return {
      ...node,
      children: node.children?.length
        ? updateTaxonomyNodeLabel(node.children, nodeId, normalizedPatch)
        : node.children,
    };
  });
}
