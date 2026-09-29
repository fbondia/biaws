export interface PermissionScope {
  workspace?: boolean;
  applicationIds?: string[];
}
export interface Actor {
  userId: string;
  email?: string;
  displayName?: string;
  authenticationMethod?: "session" | "api-key";
  sessionId?: string | null;
  apiKeyId?: string | null;
  technicalRole?: string;
  platformPermissions?: string[];
  groups?: (string | { id: string; name?: string })[];
  permissions?: string[];
  workspaceId?: string | null;
  workspaces?: { id: string; name?: string; [field: string]: unknown }[];
  permissionScopes?: Record<string, PermissionScope>;
}
export interface AuthorizationScope {
  workspaceId?: string;
  workspace?: boolean;
  applicationIds?: string[];
}
export interface RepositoryOptions {
  authorizationScope?: AuthorizationScope;
  workspaceId?: string;
  applicationId?: string;
  db?: string;
  database?: string;
}
export type RepositoryQuery = RepositoryOptions & Record<string, unknown>;

export interface MiddlewareRequest {
  actor?: Partial<Actor>;
  params?: Record<string, string | string[]>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  referencePermissions?: string[];
  path?: string;
  headers?: import("node:http").IncomingHttpHeaders;
}
export interface ErrorResponsePort {
  status(code: number): {
    json(body: { error: Record<string, unknown> }): unknown;
  };
}
