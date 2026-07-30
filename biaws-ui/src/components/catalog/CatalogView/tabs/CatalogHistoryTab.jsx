import { AuditHistory } from "../../../shared/AuditHistory.jsx";

export function CatalogHistoryTab({ context }) {
  return (
    <AuditHistory
      entityId={context.application.id}
      entityType="application"
      refreshKey={context.application.updatedAt}
    />
  );
}
