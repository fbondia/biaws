import type { Document } from "mongodb";

export interface SkillFile {
  path: string;
  contentBase64: string;
  size: number;
  sha256: string;
}

export interface SkillDocument extends Document {
  skillId: string;
  version: string;
  name: string;
  description: string;
  changelog: string;
  compatibility: Record<string, unknown>;
  dependencies: Record<string, unknown>;
  files: SkillFile[];
  workspaceId: string;
  collectionId: string;
  status: string;
  packageSha256: string;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicSkillDocument = Pick<
  SkillDocument,
  | "skillId"
  | "version"
  | "name"
  | "description"
  | "changelog"
  | "compatibility"
  | "dependencies"
  | "files"
  | "workspaceId"
  | "collectionId"
  | "status"
  | "packageSha256"
  | "createdAt"
  | "updatedAt"
> & { _id: string };
