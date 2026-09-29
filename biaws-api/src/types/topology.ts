import type { ObjectId } from "mongodb";
export type MetadataValue = string | number | boolean | null | MetadataValue[];
export interface TopologyDocument {
  _id?: ObjectId;
  id: string;
  key: string;
  workspaceId: string;
  applicationId?: string;
  name: string;
  status: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  archivedAt?: Date;
  archivedBy?: string;
  archivedFromStatus?: string;
}
export interface ComponentFields {
  key: string;
  name: string;
  description: string;
  type: string;
  tags: string[];
  repositoryLinks: { repositoryId: string; role: string }[];
  dependencies: { componentId: string; kind: string; description: string }[];
}
export interface ComponentDocument extends TopologyDocument, ComponentFields {
  applicationId: string;
}
export interface IntegrationDocument extends TopologyDocument {
  applicationId: string;
  targetApplicationId: string;
  description: string;
}
export interface RepositorySync {
  mode: string;
  state: string;
  lastSyncedAt: Date | null;
}
export interface RepositoryFields {
  key: string;
  name: string;
  description: string;
  provider: string;
  organization: string;
  url: string;
  defaultBranch: string;
  sync: RepositorySync;
}
export interface RepositoryDocument extends TopologyDocument, RepositoryFields {
  applicationId: string;
}
export interface ServerFields {
  key: string;
  name: string;
  description: string;
  hostname: string;
  addresses: string[];
  provider: string;
  location: string;
  operatingSystem: string;
  purpose: string;
  status: string;
  tags: string[];
}
export interface ServerDocument extends TopologyDocument, ServerFields {
  collectionId?: string;
}
export interface DeploymentSource {
  repositoryId: string | null;
  revision: string;
}
export interface Publication {
  id: string;
  version: string;
  revision: string;
  repositoryId: string | null;
  publishedAt: Date | null;
  status: string;
  [field: string]: unknown;
}
export interface DeploymentFields {
  key: string;
  name: string;
  componentId: string;
  environment: string;
  repositoryId: string | null;
  publications: Publication[];
  version: string;
  source: DeploymentSource;
  status: string;
  deployedAt: Date | null;
}
export interface DeploymentDocument extends TopologyDocument, DeploymentFields {
  applicationId: string;
}
export type DeploymentState = Partial<DeploymentDocument>;
export interface RuntimeFields {
  key: string;
  name: string;
  kind: string;
  serverId: string | null;
  endpoint: string;
  port: number | null;
  namespace: string;
  runtimeName: string;
  status: string;
  metadata: Record<string, MetadataValue>;
  monitoringRetentionDays: number;
  observedAt: Date | null;
  documentLinks: { documentId: string; purpose: string }[];
  operationalNotesMarkdown: string;
}
export interface RuntimeDocument extends TopologyDocument, RuntimeFields {
  applicationId: string;
  deploymentId: string;
  componentId: string;
  monitoringObservedAt?: Date;
  monitoring?: {
    signalId?: string | null;
    status: string;
    observedAt: Date;
    receivedAt: Date;
    source: string;
    message: string;
  };
}
