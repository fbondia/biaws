import { readFile, writeFile } from "node:fs/promises";
import prettier from "prettier";
import { buildOpenApiDocument } from "../src/contracts/openapi.ts";

const output = new URL("../openapi/openapi.json", import.meta.url);
const prettierConfig = JSON.parse(
  await readFile(
    new URL("../../prettier/.prettierrc", import.meta.url),
    "utf8",
  ),
);
const generated = await prettier.format(
  JSON.stringify(buildOpenApiDocument()),
  {
    ...prettierConfig,
    parser: "json",
  },
);
if (process.argv.includes("--write")) {
  await writeFile(output, generated);
  console.log(`Generated ${output.pathname}`);
} else if (process.argv.includes("--check")) {
  const saved = await readFile(output, "utf8");
  if (saved !== generated) {
    console.error("OpenAPI document is stale; run npm run openapi:generate");
    process.exitCode = 1;
  } else {
    console.log("OpenAPI document matches the Zod route contracts");
  }
} else {
  process.stdout.write(generated);
}
