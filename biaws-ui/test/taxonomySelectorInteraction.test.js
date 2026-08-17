import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

async function renderSelector(mountTaxonomySelector, options) {
  const container = document.createElement("div");
  document.body.append(container);
  const harness = mountTaxonomySelector(container, options);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { container, harness };
}

async function enterAndSubmitLastNodeLabel(container, label) {
  const inputs = [
    ...container.querySelectorAll('input[placeholder="Novo nó"]'),
  ];
  const input = inputs.at(-1);
  const valueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  ).set;
  valueSetter.call(input, label);
  input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  input.closest("form").requestSubmit();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

test("taxonomy selector creates repeated child labels and reports rejected additions", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "biaws-taxonomy-ui-"));
  const dom = new JSDOM("<!doctype html><body></body>", {
    url: "https://biaws.example.test",
  });
  const previous = Object.fromEntries(
    ["document", "navigator", "window"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    window: { configurable: true, value: dom.window },
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  try {
    await build({
      configFile: false,
      logLevel: "silent",
      plugins: [react()],
      build: {
        emptyOutDir: false,
        lib: {
          entry: join(
            process.cwd(),
            "test/fixtures/TaxonomySelectorHarness.jsx",
          ),
          fileName: "taxonomy-selector-harness",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { mountTaxonomySelector } = await import(
      pathToFileURL(join(outputDirectory, "taxonomy-selector-harness.js"))
    );

    const successful = await renderSelector(mountTaxonomySelector);
    await enterAndSubmitLastNodeLabel(successful.container, "Detalhes");
    assert.ok(
      successful.container.querySelector('[title="Serviço / Detalhes"]'),
    );
    successful.harness.root.unmount();
    successful.container.remove();

    const rejected = await renderSelector(mountTaxonomySelector, {
      rejectAdd: true,
    });
    await enterAndSubmitLastNodeLabel(rejected.container, "Novo filho");
    assert.match(
      rejected.container.querySelector('[role="alert"]').textContent,
      /não foi possível adicionar/iu,
    );
    rejected.harness.root.unmount();
  } finally {
    for (const [name, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
    await rm(outputDirectory, { force: true, recursive: true });
  }
});
