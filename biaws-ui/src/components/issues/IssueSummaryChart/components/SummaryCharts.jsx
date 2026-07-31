import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { TYPE_OPTIONS } from "../../../../constants/issues.js";
import { formatDate } from "../../../../utils/issues.js";
import { chartData, chartLabel, CHART_COLORS } from "../model.js";
import { SummaryChartFrame, SummaryTooltip } from "./ChartSupport.jsx";
import { TaxonomySummaryChart } from "./TaxonomySummaryChart.jsx";

export function LineSummaryChart({ items }) {
  const data = chartData(items);

  return (
    <SummaryChartFrame>
      <ResponsiveContainer height={300} width="100%">
        <LineChart
          data={data}
          margin={{ top: 14, right: 18, bottom: 10, left: 0 }}
        >
          <CartesianGrid
            stroke="#e5e7eb"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            interval="preserveStartEnd"
            minTickGap={24}
            tick={{ fill: "#667085", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#667085", fontSize: 12 }}
            tickLine={false}
            width={38}
          />
          <Tooltip content={<SummaryTooltip />} />
          <Line
            activeDot={{ r: 6 }}
            dataKey="count"
            dot={{ r: 4 }}
            name="Chamados"
            stroke="#2d6cdf"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </SummaryChartFrame>
  );
}

function formatBarLabel(value) {
  return value ? value : "";
}

export function BarSummaryChart({ activeTab, items, onSelectMonthTaxonomy }) {
  const data = chartData(items);
  const isStackedByType = activeTab === "byMonth" || activeTab === "byYear";
  const canSelectMonth =
    activeTab === "byMonth" && Boolean(onSelectMonthTaxonomy);
  const configuredTypeValues = TYPE_OPTIONS.filter(
    (option) => option.value,
  ).map((option) => option.value);
  const observedTypeValues = items.flatMap((item) =>
    Object.entries(item)
      .filter(
        ([key, value]) =>
          !["key", "count", "color", "name"].includes(key) &&
          Number.isFinite(Number(value)),
      )
      .map(([key]) => key),
  );
  const stackedTypeBars = [
    ...new Set([...configuredTypeValues, ...observedTypeValues]),
  ].map((key, index) => ({
    key,
    label: chartLabel(key),
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  function selectMonthItem(selectedItem) {
    if (canSelectMonth && selectedItem?.key) {
      onSelectMonthTaxonomy(selectedItem);
    }
  }

  function handleBarClick(barItem) {
    selectMonthItem(barItem?.payload || barItem);
  }

  function handleChartClick(event) {
    const selectedItem =
      event?.activePayload?.[0]?.payload ||
      data[event?.activeTooltipIndex] ||
      data.find(
        (item) =>
          item.key === event?.activeLabel || item.name === event?.activeLabel,
      );

    selectMonthItem(selectedItem);
  }

  return (
    <SummaryChartFrame>
      <ResponsiveContainer height={320} width="100%">
        <BarChart
          data={data}
          margin={{ top: 28, right: 18, bottom: 10, left: 0 }}
          onClick={handleChartClick}
          style={{ cursor: canSelectMonth ? "pointer" : "default" }}
        >
          <CartesianGrid
            stroke="#e5e7eb"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            interval={0}
            tick={{ fill: "#667085", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#667085", fontSize: 12 }}
            tickLine={false}
            width={38}
          />
          <Tooltip content={<SummaryTooltip />} />
          {isStackedByType ? (
            <>
              <Legend
                formatter={(value) => (
                  <span className="summaryLegendText">{value}</span>
                )}
                iconType="circle"
                verticalAlign="top"
              />
              {stackedTypeBars.map((typeBar, index) => (
                <Bar
                  dataKey={typeBar.key}
                  fill={typeBar.color}
                  key={typeBar.key}
                  name={typeBar.label}
                  onClick={canSelectMonth ? handleBarClick : undefined}
                  radius={
                    index === stackedTypeBars.length - 1
                      ? [6, 6, 0, 0]
                      : [0, 0, 0, 0]
                  }
                  stackId="type"
                >
                  <LabelList
                    dataKey={typeBar.key}
                    fill="#ffffff"
                    fontSize={12}
                    fontWeight={700}
                    formatter={formatBarLabel}
                    position="center"
                  />
                </Bar>
              ))}
            </>
          ) : (
            <Bar
              dataKey="count"
              name="Chamados"
              onClick={canSelectMonth ? handleBarClick : undefined}
              radius={[6, 6, 0, 0]}
            >
              <LabelList
                dataKey="count"
                fill="#344054"
                fontSize={12}
                fontWeight={700}
                formatter={formatBarLabel}
                position="top"
              />
              {data.map((entry) => (
                <Cell fill={entry.color} key={entry.key} />
              ))}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
    </SummaryChartFrame>
  );
}

export function MonthTaxonomyPanel({
  error,
  loading,
  onClear,
  onOpenIssue,
  selectedMonth,
  summary,
  taxonomyPackage,
}) {
  if (!selectedMonth && !loading && !error) return null;

  return (
    <div className="summaryDrilldownPanel">
      <div className="summaryDrilldownHeader">
        <div>
          <span>Assunto</span>
          <strong>{selectedMonth?.name || selectedMonth?.key || "Mês"}</strong>
        </div>
        <button className="secondaryButton" onClick={onClear} type="button">
          Fechar
        </button>
      </div>

      {loading ? (
        <div className="loadingLine">Carregando assuntos...</div>
      ) : null}
      {error ? <div className="summaryDrilldownError">{error}</div> : null}
      {!loading && !error ? (
        <TaxonomySummaryChart
          items={summary?.byTaxonomy || []}
          onOpenIssue={onOpenIssue}
          taxonomyPackage={taxonomyPackage}
        />
      ) : null}
    </div>
  );
}

export function PieSummaryChart({ items }) {
  const data = chartData(items);

  return (
    <SummaryChartFrame className="summaryPieCard">
      <ResponsiveContainer height={320} width="100%">
        <PieChart>
          <Tooltip content={<SummaryTooltip />} />
          <Legend
            formatter={(value) => (
              <span className="summaryLegendText">{value}</span>
            )}
            iconType="circle"
            verticalAlign="middle"
          />
          <Pie
            cx="42%"
            cy="50%"
            data={data}
            dataKey="count"
            innerRadius={64}
            nameKey="name"
            outerRadius={112}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell fill={entry.color} key={entry.key} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </SummaryChartFrame>
  );
}
