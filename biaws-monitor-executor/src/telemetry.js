const METRIC_PREFIX = "biaws_monitor_executor_";

export function createTelemetry({ now = () => new Date() } = {}) {
  const counters = new Map();
  const gauges = new Map();
  const observations = new Map();

  return {
    increment(name, value = 1) {
      counters.set(name, (counters.get(name) || 0) + value);
    },
    gauge(name, value) {
      gauges.set(name, Number(value));
    },
    observe(name, value) {
      const current = observations.get(name) || { count: 0, sum: 0 };
      observations.set(name, {
        count: current.count + 1,
        sum: current.sum + Number(value),
      });
    },
    snapshot() {
      return {
        generatedAt: now().toISOString(),
        counters: Object.fromEntries(counters),
        gauges: Object.fromEntries(gauges),
        observations: Object.fromEntries(observations),
      };
    },
    prometheus() {
      const lines = [];
      for (const [name, value] of counters) {
        lines.push(`${METRIC_PREFIX}${name}_total ${value}`);
      }
      for (const [name, value] of gauges) {
        lines.push(`${METRIC_PREFIX}${name} ${value}`);
      }
      for (const [name, value] of observations) {
        lines.push(`${METRIC_PREFIX}${name}_count ${value.count}`);
        lines.push(`${METRIC_PREFIX}${name}_sum ${value.sum}`);
      }
      return `${lines.join("\n")}\n`;
    },
  };
}
