import type { Document } from "mongodb";
export interface SecretProviderContext {
  workspaceId: unknown;
  secretId: unknown;
  version: unknown;
}
export interface SecretVersion {
  version: number;
  locator: string;
  createdAt: Date;
  createdBy?: string | null;
  kind?: string;
  fileName?: string;
  mediaType?: string;
  size?: number;
}
export interface SecretContent {
  kind: string;
  size: number;
  fileName?: string;
  mediaType?: string;
}
export interface SecretDocument extends Document {
  id: string;
  workspaceId: string;
  applicationId: string | null;
  identifier: string;
  name: string;
  normalizedName: string;
  description: string;
  type: string;
  environment: string;
  provider: string | null;
  status: string;
  currentVersion: number;
  versions: SecretVersion[];
  contentKind?: string;
  provisioningStatus?: string | null;
  collectionId?: string | null;
  createdAt: Date;
  createdBy?: string | null;
  updatedAt: Date;
  updatedBy?: string | null;
  archivedAt?: Date | null;
  archivedBy?: string | null;
}
