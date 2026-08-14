import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("monitoring panel configures and exposes ordering for selected widgets", async () => {
  const outputDirectory = await mkdtemp(
    join(tmpdir(), "biaws-monitoring-panel-ui-"),
  );
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
            "test/fixtures/MonitoringPanelSelectorHarness.jsx",
          ),
          fileName: "monitoring-panel-selector-harness",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { mountMonitoringPanelSelector } = await import(
      pathToFileURL(
        join(outputDirectory, "monitoring-panel-selector-harness.js"),
      )
    );
    const harness = mountMonitoringPanelSelector(
      document.getElementById("app"),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const size = document.querySelector(
      'select[aria-label="Tamanho de API Produção"]',
    );
    assert.equal(size.value, "small");
    size.value = "large";
    size.dispatchEvent(new window.Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(
      document.querySelectorAll(".monitoringPanelDragHandle").length,
      2,
    );
    assert.match(document.body.textContent, /Arraste para definir a ordem/u);
    [...document.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Aplicar seleção"))
      .click();

    assert.deepEqual(harness.getSavedWidgets(), [
      { runtimeId: "runtime-1", size: "large" },
      { runtimeId: "runtime-2", size: "medium-2" },
    ]);
    harness.root.unmount();
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
