import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const UI_ROOT = fileURLToPath(new URL("../", import.meta.url));

async function loadCssGraph(entryFile, visited = new Set()) {
  const absoluteFile = path.resolve(UI_ROOT, entryFile);
  if (visited.has(absoluteFile)) return "";
  visited.add(absoluteFile);

  const source = await readFile(absoluteFile, "utf8");
  const importedSources = [];
  for (const match of source.matchAll(/@import\s+["']([^"']+)["']/gu)) {
    if (!match[1].startsWith(".")) continue;
    importedSources.push(
      await loadCssGraph(
        path.resolve(path.dirname(absoluteFile), match[1]),
        visited,
      ),
    );
  }
  return [source, ...importedSources].join("\n");
}

function assertSelector(source, selector) {
  assert.match(
    source,
    new RegExp(`\\.${selector}(?![A-Za-z0-9_-])`, "u"),
    `Seletor ausente no grafo CSS de Melhorias: .${selector}`,
  );
}

test("requests CSS graph includes its shared collection and UI primitives", async () => {
  const source = [
    await loadCssGraph("src/styles.css"),
    await loadCssGraph("src/styles/features/requests/index.css"),
  ].join("\n");

  for (const selector of [
    "contentBand",
    "detailTabs",
    "panelHeader",
    "spinIcon",
    "resourceCollectionTreeRow",
    "resourceCollectionItemContent",
    "requestCollectionsNavigator",
  ]) {
    assertSelector(source, selector);
  }
});

test("shared collection navigation is not owned by the knowledge feature", async () => {
  const globalEntry = await readFile(
    path.join(UI_ROOT, "src/styles.css"),
    "utf8",
  );
  const knowledgeEntry = await readFile(
    path.join(UI_ROOT, "src/styles/features/knowledge/index.css"),
    "utf8",
  );

  assert.match(globalEntry, /shared\/resource-collection-navigator\.css/u);
  assert.doesNotMatch(knowledgeEntry, /resource-collection-navigator/u);
  assert.ok(
    globalEntry.indexOf("resource-collection-navigator.css") <
      globalEntry.indexOf("resource-collections.css"),
    "legacy navigator rules must load before shared component rules",
  );
});
