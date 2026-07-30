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

const tokenSource = readFileSync(tokenFile, "utf8");
const errors = [];

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

for (const file of cssFiles(stylesDirectory)) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/--([a-z0-9-]+):\s*var\(--\1\)/gi)) {
    errors.push(`Variável autorreferente em ${file}: --${match[1]}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Tokens e referências CSS validados com sucesso.");
}
