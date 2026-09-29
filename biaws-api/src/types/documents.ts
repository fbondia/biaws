import type { Document } from "mongodb";
import type { ObjectId } from "mongodb";
import type { KnowledgeContextInput } from "./requests.js";
export interface DocumentReference {
  targetDocumentId: string;
  relationship: string;
}
export interface KnowledgeDocument extends KnowledgeContextInput {
  _id?: ObjectId | string;
  id?: string;
  identifier?: string | null;
  documentType?: string;
  schemaVersion?: number;
  title?: string;
  summary?: string;
  markdown?: string;
  status?: string;
  details?: Record<string, unknown>;
  classification?: Record<string, unknown>;
  source?: Record<string, unknown>;
  collectionId?: string;
  references?: DocumentReference[];
  attachments?: unknown[];
  definedAt?: string;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewedBy?: string;
  archivedFromStatus?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type PublicStoredKnowledgeDocument = Omit<
  KnowledgeDocument,
  "_id" | "id"
> &
  Pick<
    StoredKnowledgeDocument,
    | "id"
    | "identifier"
    | "workspaceId"
    | "applicationId"
    | "affectedComponentIds"
    | "documentType"
    | "title"
    | "summary"
    | "status"
    | "collectionId"
    | "references"
    | "classification"
    | "source"
    | "details"
  > & { _id?: string };

export interface StoredKnowledgeDocument extends Document, KnowledgeDocument {
  _id?: ObjectId;
  id: string;
  workspaceId: string;
  applicationId: string | null;
  affectedComponentIds: string[];
  documentType: string;
  title: string;
  summary: string;
  markdown?: string;
  status: string;
  collectionId: string;
  references: DocumentReference[];
  classification: {
    primaryTaxonomyId: string;
    secondaryTaxonomyIds: string[];
    tags: Record<string, string[]>;
  };
  source: Record<string, unknown>;
  details: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
