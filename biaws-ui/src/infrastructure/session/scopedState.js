import { resetIssueConstants } from "../../constants/issues.js";
import { resetRequestConstants } from "../../data/requestConstants.js";

export function clearSessionScopedState() {
  resetIssueConstants();
  resetRequestConstants();
}
