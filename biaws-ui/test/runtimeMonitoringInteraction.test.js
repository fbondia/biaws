import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("configuration interaction opens a provider-specific monitor dialog", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "biaws-monitoring-ui-"));
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
            "test/fixtures/RuntimeMonitoringHarness.jsx",
          ),
          fileName: "runtime-monitoring-harness",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { mountRuntimeMonitoring } = await import(
      pathToFileURL(join(outputDirectory, "runtime-monitoring-harness.js"))
    );
    const root = mountRuntimeMonitoring(document.getElementById("app"));

    const createButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent.includes("Novo monitoramento"),
    );
    assert.ok(createButton);
    createButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const dialog = document.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.match(dialog.textContent, /Configurar monitoramento/u);
    assert.match(dialog.textContent, /URL HTTP\(S\), sem credenciais/u);

    const provider = dialog.querySelector('select[name="provider"]');
    provider.value = "shell";
    provider.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(dialog.textContent, /ID do script permitido/u);
    assert.doesNotMatch(dialog.textContent, /URL HTTP\(S\), sem credenciais/u);

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
