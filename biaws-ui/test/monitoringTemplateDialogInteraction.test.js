import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("template dialog exposes each semantic section as an independent tab", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "biaws-template-ui-"));
  const dom = new JSDOM("<!doctype html><div id=app></div>", {
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
            "test/fixtures/MonitoringTemplateDialogHarness.jsx",
          ),
          fileName: "monitoring-template-dialog-harness",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { mountMonitoringTemplateDialog } = await import(
      pathToFileURL(
        join(outputDirectory, "monitoring-template-dialog-harness.js"),
      )
    );
    let previewRuns = 0;
    const root = mountMonitoringTemplateDialog(
      document.getElementById("app"),
      () => {
        previewRuns += 1;
      },
    );
    const dialog = document.querySelector('[role="dialog"]');
    const tabs = [...dialog.querySelectorAll('[role="tab"]')];
    assert.deepEqual(
      tabs.map((tab) => tab.textContent),
      ["Geral", "Transformação", "Contrato e apresentação", "Teste"],
    );
    assert.match(dialog.textContent, /Identificação/u);
    assert.doesNotMatch(dialog.textContent, /Expressão JSONata/u);

    tabs[1].click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(dialog.textContent, /Transformação JSONata/u);
    assert.match(dialog.textContent, /Amostra JSON de entrada/u);

    tabs[2].click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(dialog.textContent, /Contrato JSON da saída/u);
    assert.match(dialog.textContent, /Apresentação dos campos e séries/u);

    const footer = dialog.querySelector("footer");
    assert.doesNotMatch(footer.textContent, /Testar/u);

    tabs[3].click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const testButton = [...dialog.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Testar amostra"),
    );
    testButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(previewRuns, 1);
    assert.match(dialog.textContent, /Teste do template/u);
    assert.match(dialog.textContent, /Pré-visualização/u);
    root.unmount();
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
