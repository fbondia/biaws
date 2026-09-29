import { SERVER_STATUSES } from "../../../../shared/index.js";

export const MUTABLE_SERVER_STATUSES = SERVER_STATUSES.filter((status) => status !== "archived");
