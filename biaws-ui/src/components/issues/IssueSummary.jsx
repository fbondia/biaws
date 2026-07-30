import { BarChart3, Database } from "lucide-react";

import { AGGREGATE_TABS } from "../../constants/issues.js";
import { IssueSummaryChart } from "./IssueSummaryChart/index.jsx";

export function IssueSummary({
  activeAggregate,
  meta,
  monthTaxonomyError,
  monthTaxonomyLoading,
  monthTaxonomySummary,
  onAggregateChange,
  onClearMonthTaxonomy,
  onOpenIssue,
  onSelectMonthTaxonomy,
  selectedMonthTaxonomy,
  summary,
  taxonomyPackage,
}) {
  return (
    <section className="summaryBand">
      <div className="aggregateArea">
        <div className="summaryHeader">
          <div className="tabs" role="tablist" aria-label="Agregações">
            {AGGREGATE_TABS.map((tab) => (
              <button
                aria-selected={activeAggregate === tab.key}
                className={
                  activeAggregate === tab.key ? "tab activeTab" : "tab"
                }
                key={tab.key}
                onClick={() => onAggregateChange(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="summaryMetrics">
            <div className="metric">
              <Database size={17} />
              <div>
                <span>Total</span>
                <strong>{summary?.meta?.total ?? meta.total ?? 0}</strong>
              </div>
            </div>
            <div className="metric">
              <BarChart3 size={17} />
              <div>
                <span>Retornados</span>
                <strong>{meta.returned ?? 0}</strong>
              </div>
            </div>
          </div>
        </div>
        <IssueSummaryChart
          activeTab={activeAggregate}
          data={summary}
          monthTaxonomyError={monthTaxonomyError}
          monthTaxonomyLoading={monthTaxonomyLoading}
          monthTaxonomySummary={monthTaxonomySummary}
          onClearMonthTaxonomy={onClearMonthTaxonomy}
          onOpenIssue={onOpenIssue}
          onSelectMonthTaxonomy={onSelectMonthTaxonomy}
          selectedMonthTaxonomy={selectedMonthTaxonomy}
          taxonomyPackage={taxonomyPackage}
        />
      </div>
    </section>
  );
}
