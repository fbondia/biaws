import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("home dashboard exposes widget controls while personalizing", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "biaws-home-ui-"));
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
          entry: join(process.cwd(), "test/fixtures/HomeDashboardHarness.jsx"),
          fileName: "home-dashboard-harness",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { mountEditingHomeDashboard, mountMonitoringHomeDashboard } =
      await import(
        pathToFileURL(join(outputDirectory, "home-dashboard-harness.js"))
      );
    const root = mountEditingHomeDashboard(document.getElementById("app"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const sizeControl = document.querySelector(".homeWidgetSizeChip");
    assert.ok(sizeControl?.querySelector("select"));
    assert.match(sizeControl.textContent, /Tamanho de Chamados no período/u);
    assert.ok(
      document.querySelector(
        'button[aria-label="Configurar Chamados no período"]',
      ),
    );
    assert.ok(
      document.querySelector(
        'button[aria-label="Remover Chamados no período"]',
      ),
    );
    assert.equal(document.querySelector(".homeWidget").draggable, true);
    root.unmount();

    let requestedRuntime;
    const monitoringRoot = mountMonitoringHomeDashboard(
      document.getElementById("app"),
      (runtime) => {
        requestedRuntime = runtime;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    document
      .querySelector('button[aria-label="Executar monitor de Principal"]')
      .click();
    assert.equal(requestedRuntime.id, "runtime-1");
    assert.equal(requestedRuntime.applicationId, "application-1");
    monitoringRoot.unmount();

    const pendingRoot = mountMonitoringHomeDashboard(
      document.getElementById("app"),
      () => {},
      true,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const pendingButton = document.querySelector(
      'button[aria-label="Executar monitor de Principal"]',
    );
    assert.equal(pendingButton.disabled, true);
    assert.ok(pendingButton.querySelector(".spinIcon"));
    pendingRoot.unmount();
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
