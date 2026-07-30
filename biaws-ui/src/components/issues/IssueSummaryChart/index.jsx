import { CHART_TYPES } from "./model.js";
import {
  BarSummaryChart,
  LineSummaryChart,
  MonthTaxonomyPanel,
  PieSummaryChart,
} from "./components/SummaryCharts.jsx";
import { TaxonomySummaryChart } from "./components/TaxonomySummaryChart.jsx";

export function IssueSummaryChart({
  activeTab,
  data,
  monthTaxonomyError,
  monthTaxonomyLoading,
  monthTaxonomySummary,
  onClearMonthTaxonomy,
  onOpenIssue,
  onSelectMonthTaxonomy,
  selectedMonthTaxonomy,
  taxonomyPackage,
}) {
  const items = data?.[activeTab] || [];
  const chartType = CHART_TYPES[activeTab] || "bar";

  if (chartType === "taxonomy") {
    return (
      <TaxonomySummaryChart
        items={items}
        onOpenIssue={onOpenIssue}
        taxonomyPackage={taxonomyPackage}
      />
    );
  }

  if (!items.length) {
    return (
      <div className="emptyState">
        Sem dados agregados para os filtros atuais.
      </div>
    );
  }

  if (chartType === "line") return <LineSummaryChart items={items} />;
  if (chartType === "pie") return <PieSummaryChart items={items} />;

  return (
    <>
      <BarSummaryChart
        activeTab={activeTab}
        items={items}
        onSelectMonthTaxonomy={onSelectMonthTaxonomy}
      />
      {activeTab === "byMonth" ? (
        <MonthTaxonomyPanel
          error={monthTaxonomyError}
          loading={monthTaxonomyLoading}
          onClear={onClearMonthTaxonomy}
          onOpenIssue={onOpenIssue}
          selectedMonth={selectedMonthTaxonomy}
          summary={monthTaxonomySummary}
          taxonomyPackage={taxonomyPackage}
        />
      ) : null}
    </>
  );
}
