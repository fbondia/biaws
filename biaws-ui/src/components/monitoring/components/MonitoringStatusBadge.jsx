export function MonitoringStatusBadge({ className = "", status = "unknown" }) {
  const classes = [`catalogStatus`, `catalogStatus-${status}`, className]
    .filter(Boolean)
    .join(" ");

  return <span className={classes}>{status}</span>;
}
