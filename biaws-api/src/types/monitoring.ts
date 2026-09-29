import type { Document } from "mongodb";
export interface MonitorTemplateRef {
  id: string;
  version: string;
}
export interface MonitorLease {
  trigger: string;
  executionId: string;
  token?: string;
  executorId?: string;
  leasedAt?: Date;
  scheduledFor?: Date;
  leasedUntil?: Date;
  completedAt?: Date | null;
}
export interface ActiveMonitorDocument extends Document {
  id: string;
  workspaceId: string;
  applicationId: string;
  deploymentId: string;
  runtimeId: string;
  name: string;
  nameKey: string;
  description: string;
  provider: string;
  enabled: boolean;
  intervalSeconds: number;
  timeoutSeconds: number;
  configuration: Record<string, unknown>;
  templateRef: MonitorTemplateRef | null;
  nextRunAt: Date | null;
  version: number;
  createdAt: Date;
  createdBy?: string;
  updatedAt: Date;
  updatedBy?: string;
  archivedAt?: Date;
  lease?: MonitorLease;
  manualRunRequest?: { id: string; requestedAt: Date };
}

export interface MonitoringTemplateDocument extends Document {
  id: string;
  workspaceId: string;
  name: string;
  nameKey: string;
  description: string;
  version: string;
  versionNumber: number;
  status: string;
  definition: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
