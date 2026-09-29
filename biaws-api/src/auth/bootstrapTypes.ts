export interface BootstrapRecord {
  _id?: { toString(): string };
  id?: string;
  email?: string;
  role?: string;
  expiresAt?: string | number | Date | null;
  metadata?: Record<string, unknown>;
}
export interface UserCreation {
  body: {
    email: string;
    password: string;
    name: string;
    role: "admin" | "user";
  };
}
export interface KeyCreation {
  body: {
    name: string;
    userId: string;
    metadata: Record<string, unknown>;
    rateLimitEnabled: boolean;
    rateLimitTimeWindow: number;
    rateLimitMax: number;
  };
}
export interface BootstrapAdminAuth {
  api: { createUser(input: UserCreation): Promise<{ user: BootstrapRecord }> };
}
export interface BootstrapAgentAuth extends BootstrapAdminAuth {
  api: BootstrapAdminAuth["api"] & {
    createApiKey(input: KeyCreation): Promise<{ key: string }>;
  };
}
export interface BootstrapCollection {
  findOne(filter: object): Promise<BootstrapRecord | null>;
  updateOne?(filter: object, update: object): Promise<unknown>;
}
export interface BootstrapDatabase {
  collection(name: string): BootstrapCollection;
}
export function bootstrapUserId(user: BootstrapRecord): string {
  const id = user._id?.toString() || user.id;
  if (!id) throw new Error("Bootstrap identity is missing its user ID");
  return id;
}
