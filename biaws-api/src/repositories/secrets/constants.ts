import { DEPLOYMENT_ENVIRONMENTS } from "../../../../shared/index.js";

export const SECRET_TYPES = new Set(["password", "api-key", "token", "private-key", "generic"]);

export const SECRET_ENVIRONMENTS = new Set([...DEPLOYMENT_ENVIRONMENTS, ""]);

export const SECRET_IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])$/u;
