import type { ObjectId } from "mongodb";
export interface KnowledgeContextInput {
  workspaceId?: unknown;
  applicationId?: unknown;
  affectedComponentIds?: unknown;
}
export interface KnowledgeContext {
  workspaceId: string;
  applicationId: string | null;
  affectedComponentIds: string[];
}
export interface ChecklistInput {
  label?: unknown;
  done?: unknown;
  date?: unknown;
  comment?: unknown;
}
export interface RequestDocument extends KnowledgeContextInput {
  _id?: ObjectId;
  clientCode?: string;
  title?: string;
  status?: string;
  estimatedDeliveryDate?: string;
  startDate?: string;
  endDate?: string;
  estimatedJourneys?: number;
  description?: string;
  collectionId?: string | null;
  checklist?: ChecklistInput[];
  attachments?: unknown[];
  listRank?: number;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
export interface NoteDocument {
  _id?: ObjectId | string;
  requestId?: ObjectId | string;
  date?: string | Date;
  content?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
export interface TaskDocument {
  _id?: ObjectId | string;
  requestId?: ObjectId | string;
  code?: string;
  title?: string;
  status?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  situation?: string;
  description?: string;
  specification?: string;
  notes?: NoteDocument[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
export interface Journey {
  month: string;
  plannedJourneys: number;
  executedJourneys: number;
  comment: string;
}
export interface SpecificationSection {
  id: string;
  title: string;
  content: string;
  order: number;
}
export interface Specification {
  sections: SpecificationSection[];
}
