import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const stylesDirectory = fileURLToPath(
  new URL("../src/styles/", import.meta.url),
);
const tokenFile = new URL(
  "../src/styles/foundations/tokens.css",
  import.meta.url,
);

function cssFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory()
      ? cssFiles(entryPath)
      : entry.name.endsWith(".css")
        ? [entryPath]
        : [];
  });
}

const requiredColorTokens = [
  "color-background",
  "color-surface",
  "color-surface-subtle",
  "color-surface-muted",
  "color-text",
  "color-text-secondary",
  "color-text-muted",
  "color-text-subtle",
  "color-border",
  "color-border-subtle",
  "color-border-strong",
  "color-accent-text",
  "color-accent-border",
  "color-focus",
];
const requiredSemanticColorTokens = [
  "color-danger-surface",
  "color-danger-border",
  "color-danger-text",
  "color-success-surface",
  "color-success-text",
  "color-warning-surface",
  "color-warning-border",
  "color-warning-text",
  "color-info-surface",
  "color-info-border",
  "color-focus-ring",
  "color-overlay-backdrop",
  "color-shadow-dialog",
];

const tokenSource = readFileSync(tokenFile, "utf8");
const errors = [];
const styleFiles = cssFiles(stylesDirectory);
const declaredVariables = new Set();
const runtimeVariables = new Set([
  "billing-month-count",
  "depth",
  "file-tag-background",
  "file-tag-border",
  "file-tag-color",
  "gantt-demand-width",
  "gantt-min-width",
  "gantt-row-depth",
  "request-list-width",
  "request-status-background",
  "request-status-border",
  "request-status-foreground",
  "resource-collections-navigation-width",
]);

for (const file of styleFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/--([a-z0-9-]+)\s*:/gi)) {
    declaredVariables.add(match[1]);
  }
}

for (const token of requiredColorTokens) {
  const definition = tokenSource
    .match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1]
    ?.trim();
  if (!definition) {
    errors.push(`Token obrigatório ausente: --${token}`);
  } else if (definition.includes(`var(--${token})`)) {
    errors.push(`Token autorreferente: --${token}`);
  } else if (!/^#[0-9a-f]{6}$/i.test(definition)) {
    errors.push(
      `Token de cor deve ter um valor hexadecimal concreto: --${token}`,
    );
  }
}

for (const token of requiredSemanticColorTokens) {
  const definition = tokenSource
    .match(new RegExp(`--${token}:\\s*([^;]+);`))?.[1]
    ?.trim();
  if (!definition) {
    errors.push(`Token semântico obrigatório ausente: --${token}`);
  } else if (definition.includes(`var(--${token})`)) {
    errors.push(`Token semântico autorreferente: --${token}`);
  }
}

for (const file of styleFiles) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/--([a-z0-9-]+):\s*var\(--\1\)/gi)) {
    errors.push(`Variável autorreferente em ${file}: --${match[1]}`);
  }
  for (const match of source.matchAll(/var\(--([a-z0-9-]+)/gi)) {
    if (!declaredVariables.has(match[1]) && !runtimeVariables.has(match[1])) {
      errors.push(`Variável CSS não declarada em ${file}: --${match[1]}`);
    }
  }
  if (/--color-palette-(?:hex|rgb)-/i.test(source)) {
    errors.push(`Token de cor nomeado pelo valor em ${file}`);
  }
  if (
    file !== fileURLToPath(tokenFile) &&
    /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|rgb\([^)]*\/[^)]*\)/i.test(source)
  ) {
    errors.push(`Cor literal fora de foundations/tokens.css em ${file}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Tokens e referências CSS validados com sucesso.");
}
