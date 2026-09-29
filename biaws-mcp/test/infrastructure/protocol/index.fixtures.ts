import path from "node:path";
import { fileURLToPath } from "node:url";
const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);
export { packageDirectory };
