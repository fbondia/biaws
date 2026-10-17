import { writeFile, readFile } from "node:fs/promises";
import { format, resolveConfig } from "prettier";
import { listTools } from "../dist/src/mcp/tools/tools.js";
import { toolPolicies } from "../dist/src/mcp/tools/toolPolicies.js";
const lines = [
  "# Catálogo e efeitos das ferramentas",
  "",
  "Gerado por scripts/catalog-matrix.mjs a partir dos contratos e da política revisada.",
  "Hints são descritivos; a API continua autorizando cada operação. readOnly=false inclui ferramentas com modo dry-run que também podem escrever.",
  "openWorld=true identifica configuração que pode alterar execução de monitores sobre destinos externos. As demais operações ficam no domínio BIAWS.",
  "As duas ferramentas EML por path são exclusivas de stdio. HTTP mantém EML em conteúdo e anexos em base64; nunca lê paths locais do cliente.",
  "",
  "| Tool | Operação | readOnly | destructive | openWorld | Transporte | Justificativa |",
  "| --- | --- | --- | --- | --- | --- | --- |",
];
for (const tool of listTools()) {
  const policy = toolPolicies[tool.name],
    a = policy.annotations;
  const clean = (v) => String(v).replaceAll("|", "/").replaceAll("\n", " ");
  lines.push(
    "| " +
      [
        tool.name,
        tool.description,
        a.readOnlyHint,
        a.destructiveHint,
        a.openWorldHint,
        policy.availability,
        policy.reason,
      ]
        .map(clean)
        .join(" | ") +
      " |",
  );
}
const output = new URL("../docs/tool-matrix.md", import.meta.url);
const content = await format(lines.join("\n") + "\n", {
  ...(await resolveConfig(output.pathname)),
  parser: "markdown",
});
if (process.argv.includes("--check")) {
  if ((await readFile(output, "utf8")) !== content) throw new Error("Regenerate tool matrix after catalog changes");
} else await writeFile(output, content);
