import type { Document } from "mongodb";

export interface IssueDocument extends Document {
  id: string;
  workspaceId: string;
  applicationId: string | null;
  affectedComponentIds?: string[];
  title?: string;
  classification?: {
    primaryTaxonomyId?: string;
    secondaryTaxonomyIds?: string[];
    [field: string]: unknown;
  };
  attachments?: unknown[];
  dates?: Record<string, unknown>;
  source?: Record<string, unknown>;
}

export type PublicIssueDocument = Pick<
  IssueDocument,
  | "id"
  | "workspaceId"
  | "applicationId"
  | "affectedComponentIds"
  | "title"
  | "classification"
  | "attachments"
  | "dates"
  | "source"
> & { _id: string };
export interface IssueCommentDocument extends Document {
  issueId: string;
  hash: string;
  text: string;
  from: string;
  date: Date | null;
  updatedBy?: string;
}
export type PublicIssueCommentDocument = Pick<
  IssueCommentDocument,
  "issueId" | "hash" | "text" | "from" | "date" | "updatedBy"
> & { _id: string };
