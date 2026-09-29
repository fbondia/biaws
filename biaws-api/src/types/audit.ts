import type { Actor } from "./http.js";
export interface AuditTarget {
  type: string;
  id: unknown;
  label?: string;
}
export interface AuditInput {
  actor?: Partial<Actor>;
  action: string;
  target: AuditTarget;
  root?: AuditTarget;
  before?: unknown;
  after?: unknown;
  summary?: string;
  metadata?: unknown;
  occurredAt?: Date;
}
export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}
