import type { Logger } from "../logging/logger.js";
import type { Actor } from "./http.js";
declare global {
  namespace Express {
    interface Request {
      actor: Actor;
      requestId?: string;
      log?: Logger;
      referencePermissions?: string[];
    }
  }
  interface Error {
    statusCode?: number;
    status?: number;
    code?: string | number;
    requiredPermissions?: unknown[];
    fields?: { path?: unknown; code?: unknown; message?: unknown }[];
    details?: object;
    retryable?: boolean;
    templateRef?: { id: string; version: string };
    templateSnapshot?: unknown;
    publicDetails?: {
      diagnostic?: { code?: string; phase?: string; position?: number | null };
    };
    position?: number;
  }
}
export {};
