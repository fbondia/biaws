import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { formatDate } from "../../../../utils/issues.js";
import {
  buildTaxonomySummaryNode,
  chartLabel,
  collectTaxonomyIds,
  flattenTaxonomySummary,
  taxonomyItemMap,
} from "../model.js";
import { EntityIdentifier } from "../../../shared/EntityIdentifier/index.jsx";

export function TaxonomySummaryChart({ items, onOpenIssue, taxonomyPackage }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const itemsById = useMemo(() => taxonomyItemMap(items), [items]);
  const taxonomyNodes = taxonomyPackage?.taxonomy || [];
  const knownTaxonomyIds = useMemo(
    () => collectTaxonomyIds(taxonomyNodes),
    [taxonomyNodes],
  );
  const tree = useMemo(
    () =>
      taxonomyNodes
        .map((node) => buildTaxonomySummaryNode(node, itemsById))
        .filter(Boolean),
    [itemsById, taxonomyNodes],
  );
  const rows = flattenTaxonomySummary(tree);
  const unknownRows = [...itemsById.entries()]
    .filter(([taxonomyId]) => !knownTaxonomyIds.has(taxonomyId))
    .map(([taxonomyId, item]) => ({
      id: taxonomyId,
      label: taxonomyId,
      path: [taxonomyId],
      depth: 0,
      directCount: item.count,
      totalCount: item.count,
      issues: item.issues,
      children: [],
    }));
  const rootRows = [...tree, ...unknownRows];
  const allRows = [...rows, ...unknownRows];

  function toggleNode(nodeId) {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }

      return next;
    });
  }

  if (!taxonomyNodes.length) {
    return (
      <div className="emptyState">
        Assuntos não carregados para os filtros atuais.
      </div>
    );
  }

  if (!allRows.length) {
    return (
      <div className="emptyState">
        Sem issues classificadas por assunto para os filtros atuais.
      </div>
    );
  }

  return (
    <div className="summaryChartCard taxonomySummaryCard">
      <div className="taxonomySummaryTree" role="tree">
        {rootRows.map((row) => (
          <TaxonomySummaryTreeNode
            expandedIds={expandedIds}
            key={row.id}
            node={row}
            onOpenIssue={onOpenIssue}
            onToggle={toggleNode}
          />
        ))}
      </div>
    </div>
  );
}

function TaxonomySummaryTreeNode({ expandedIds, node, onOpenIssue, onToggle }) {
  const hasChildren = Boolean(node.children?.length);
  const hasIssues = Boolean(node.issues?.length);
  const canExpand = hasChildren || hasIssues;
  const isExpanded = expandedIds.has(node.id);

  return (
    <>
      <div
        aria-expanded={canExpand ? isExpanded : undefined}
        aria-level={node.depth + 1}
        className="taxonomySummaryRow"
        role="treeitem"
        style={{ "--depth": node.depth }}
        title={node.path.join(" / ")}
      >
        {canExpand ? (
          <button
            aria-label={
              isExpanded ? `Recolher ${node.label}` : `Expandir ${node.label}`
            }
            className="taxonomySummaryToggle"
            onClick={() => onToggle(node.id)}
            type="button"
          >
            {isExpanded ? (
              <ChevronDown size={15} />
            ) : (
              <ChevronRight size={15} />
            )}
          </button>
        ) : (
          <span className="taxonomySummaryTogglePlaceholder" />
        )}
        <span className="taxonomySummaryCountBadge">{node.totalCount}</span>
        <div className="taxonomySummaryMain">
          <span className="taxonomySummaryLabel">{node.label}</span>
          {node.directCount && node.directCount !== node.totalCount ? (
            <span className="taxonomySummaryDirect">
              direto: {node.directCount}
            </span>
          ) : null}
        </div>
      </div>
      {canExpand && isExpanded ? (
        <div className="taxonomySummaryChildren" role="group">
          {hasIssues ? (
            <div
              className="taxonomySummaryIssues"
              style={{ "--depth": node.depth + 1 }}
            >
              {node.issues.map((issue) => (
                <article
                  className="taxonomySummaryIssue"
                  key={issue.id}
                  onClick={() => onOpenIssue?.(issue)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenIssue?.(issue);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title={issue.title || issue.id}
                >
                  <EntityIdentifier
                    className="taxonomySummaryIssueCode"
                    label="Código do issue"
                    value={issue.id}
                  />
                  <span className="taxonomySummaryIssueTitle">
                    {issue.title || "-"}
                  </span>
                  <span className="taxonomySummaryIssueMeta">
                    {chartLabel(issue.type)} · {chartLabel(issue.status)} ·{" "}
                    {formatDate(issue.date)}
                  </span>
                </article>
              ))}
            </div>
          ) : null}
          {node.children.map((child) => (
            <TaxonomySummaryTreeNode
              expandedIds={expandedIds}
              key={child.id}
              node={child}
              onOpenIssue={onOpenIssue}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
