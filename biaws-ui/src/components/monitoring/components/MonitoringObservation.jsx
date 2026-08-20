import { MonitoringMetadataPresentation } from "./MonitoringEventDetails/index.jsx";

export function MonitoringObservation({ emptyClassName, emptyMessage, event }) {
  const hasMetadata = Boolean(
    event?.metadata && Object.keys(event.metadata).length,
  );

  return hasMetadata ? (
    <MonitoringMetadataPresentation event={event} showRawFallback />
  ) : (
    <div className={emptyClassName}>{emptyMessage}</div>
  );
}
