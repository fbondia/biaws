import type { Document } from "mongodb";
import type { ObjectId } from "mongodb";
import type { IssueTypeItem } from "../helpers/issueTypeDetection.js";
export interface OptionItem {
  value: string;
  label: string;
  active: boolean;
  order: number;
  metadata: Record<string, unknown> & NonNullable<IssueTypeItem["metadata"]>;
}
export interface OptionList {
  _id?: ObjectId | string;
  id?: string;
  workspaceId?: string;
  identifier?: string | null;
  key: string;
  name: string;
  description: string;
  defaultValue: string;
  items: OptionItem[];
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface GroupScope {
  type: string;
  applicationIds: string[];
}
export interface GroupDocument {
  _id?: ObjectId | string;
  id?: string;
  workspaceId?: string;
  identifier?: string | null;
  name?: string;
  description?: string;
  permissions?: string[];
  scope?: GroupScope;
  active?: boolean;
  system?: boolean;
  systemKey?: string;
  memberIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface WorkspaceDocument extends Document {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  default: boolean;
  settings: Record<string, unknown>;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  archivedAt?: Date;
  archivedBy?: string;
}
export interface ApplicationDocument extends Document {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string;
  owner: Record<string, unknown>;
  tags: string[];
  links: { label: string; url: string }[];
  status: string;
  collectionId?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  archivedAt?: Date;
  archivedBy?: string;
}
