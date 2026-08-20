import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import "../../../../styles/features/monitoring-history.css";
import {
  monitoringHealthStatusLabel,
  monitoringHealthTimeline,
} from "./model.js";

const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatTimestamp(value) {
  return DATE_FORMAT.format(new Date(value));
}

export function MonitoringHealthTimeline({ events, monitors }) {
  const timeline = monitoringHealthTimeline(events, monitors);
  if (!timeline.points.length) {
    return (
      <div className="monitoringHealthTimelineEmpty">
        Nenhum evento com data e estado de saúde válidos para exibir no gráfico.
      </div>
    );
  }

  return (
    <section
      aria-label="Evolução temporal da saúde por monitoramento"
      className="monitoringHealthTimeline"
      role="img"
    >
      <div className="monitoringHealthTimelineScroller">
        <div className="monitoringHealthTimelineChart">
          <ResponsiveContainer height={360} width="100%">
            <LineChart
              data={timeline.points}
              margin={{ top: 20, right: 24, bottom: 12, left: 12 }}
            >
              <CartesianGrid
                stroke="var(--color-border-subtle)"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                domain={["dataMin", "dataMax"]}
                minTickGap={36}
                tickFormatter={formatTimestamp}
                tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }}
                tickLine={false}
                type="number"
              />
              <YAxis
                domain={[0, 4]}
                tickFormatter={monitoringHealthStatusLabel}
                ticks={timeline.statusTicks}
                tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }}
                tickLine={false}
                width={88}
              />
              <Tooltip
                formatter={(value, name) => [
                  monitoringHealthStatusLabel(value),
                  name,
                ]}
                labelFormatter={formatTimestamp}
              />
              <Legend />
              {timeline.series.map((item) => (
                <Line
                  connectNulls
                  dataKey={item.key}
                  dot={{ r: 4 }}
                  isAnimationActive={false}
                  key={item.id}
                  name={item.label}
                  stroke={item.color}
                  strokeWidth={2.5}
                  type="stepAfter"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <p>
        Cada linha representa um monitoramento. O gráfico considera os eventos
        carregados no histórico atual.
      </p>
    </section>
  );
}
