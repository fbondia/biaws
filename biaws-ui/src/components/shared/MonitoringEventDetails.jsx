import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  compactMonitoringValue,
  formatMonitoringValue,
  monitoringPresentationFields,
  monitoringPresentationSeries,
  monitoringStatusTone,
} from "./monitoringPresentationModel.js";

function hasProperties(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    (Array.isArray(value) || Object.keys(value).length),
  );
}

function JsonBlock({ label, showEmpty = false, value }) {
  if (!showEmpty && !hasProperties(value)) return null;
  if (value === undefined || value === null) return null;
  return (
    <div className="monitoringEventJson">
      <strong>{label}</strong>
      <pre>
        <code>{JSON.stringify(value, null, 2)}</code>
      </pre>
    </div>
  );
}

function PresentedField({ field }) {
  const formatted = formatMonitoringValue(field.value, field.format);
  if (field.visualization === "gauge" && field.format === "percent") {
    return (
      <div className="monitoringMetric monitoringMetricGauge">
        <span>{field.label}</span>
        <strong>{formatted}</strong>
        <progress
          aria-label={field.label}
          max="100"
          value={Number(field.value)}
        />
      </div>
    );
  }
  if (field.visualization === "badge" || field.format === "status") {
    return (
      <div className="monitoringMetric">
        <span>{field.label}</span>
        <strong
          className={`monitoringStatusBadge monitoringStatusBadge-${monitoringStatusTone(field.value)}`}
        >
          {formatted}
        </strong>
      </div>
    );
  }
  return (
    <div className="monitoringMetric">
      <span>{field.label}</span>
      <strong>{formatted}</strong>
    </div>
  );
}

function PresentedSeries({ series }) {
  return (
    <section className="monitoringSeries">
      <strong>{series.label}</strong>
      <ResponsiveContainer height={220} width="100%">
        <LineChart
          data={series.data}
          margin={{ top: 16, right: 18, bottom: 4, left: 4 }}
        >
          <CartesianGrid
            stroke="var(--color-border-subtle)"
            strokeDasharray="3 3"
            vertical={false}
          />
          <XAxis
            dataKey="x"
            minTickGap={20}
            tickFormatter={(value) =>
              formatMonitoringValue(value, series.xFormat)
            }
            tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(value) =>
              compactMonitoringValue(value, series.yFormat)
            }
            tick={{ fill: "var(--color-text-subtle)", fontSize: 11 }}
            tickLine={false}
            width={58}
          />
          <Tooltip
            formatter={(value) => [
              formatMonitoringValue(value, series.yFormat),
              series.label,
            ]}
            labelFormatter={(value) =>
              formatMonitoringValue(value, series.xFormat)
            }
          />
          <Line
            activeDot={{ r: 5 }}
            dataKey="y"
            dot={{ r: 3 }}
            isAnimationActive={false}
            name={series.label}
            stroke="#2d6cdf"
            strokeWidth={2.5}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

export function MonitoringMetadataPresentation({
  event,
  showRawFallback = false,
}) {
  const fields = monitoringPresentationFields(event);
  const series = monitoringPresentationSeries(event);
  if (!fields.length && !series.length) {
    return showRawFallback ? (
      <JsonBlock label="Metadados" value={event?.metadata} />
    ) : null;
  }
  return (
    <div className="monitoringPresentation">
      <div className="monitoringMetrics">
        {fields.map((field) => (
          <PresentedField field={field} key={field.key} />
        ))}
      </div>
      {series.map((item) => (
        <PresentedSeries key={`${item.xKey}:${item.yKey}`} series={item} />
      ))}
    </div>
  );
}

export function MonitoringEventDetails({ event }) {
  const hasPresentation = Boolean(event.metadataPresentation);
  return (
    <details className="monitoringEventDetails">
      <summary>Ver detalhes</summary>
      <dl>
        <div>
          <dt>Origem do registro</dt>
          <dd>{event.origin === "manual" ? "Manual" : "Externa"}</dd>
        </div>
        {event.signalId ? (
          <div>
            <dt>ID do sinal</dt>
            <dd>
              <code>{event.signalId}</code>
            </dd>
          </div>
        ) : null}
        {event.recordedBy ? (
          <div>
            <dt>Registrado por</dt>
            <dd>{event.recordedBy}</dd>
          </div>
        ) : null}
        {event.receivedAt ? (
          <div>
            <dt>Recebido em</dt>
            <dd>{new Date(event.receivedAt).toLocaleString("pt-BR")}</dd>
          </div>
        ) : null}
      </dl>
      <MonitoringMetadataPresentation event={event} />
      {!hasPresentation ? (
        <JsonBlock label="Metadata" value={event.metadata} />
      ) : null}
      <JsonBlock label="Payload" showEmpty value={event.payload} />
    </details>
  );
}
