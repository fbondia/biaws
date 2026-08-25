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
    ["document", "fetch", "navigator", "window"].map((name) => [
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
    const {
      mountEditingHomeDashboard,
      mountMonitoringHomeDashboard,
      mountRuntimeMonitoringDialog,
    } = await import(
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

    globalThis.fetch = async (url) => {
      const payload = String(url).includes("/health-summary")
        ? {
            meta: { eventCount: 2, pointCount: 2, resolution: "6h" },
            series: [
              {
                id: "monitor:http",
                label: "HTTP",
                monitorId: "http",
                points: [
                  {
                    eventCount: 1,
                    observedAt: "2026-08-20T10:00:00.000Z",
                    status: "healthy",
                  },
                ],
              },
              {
                id: "monitor:database",
                label: "Banco",
                monitorId: "database",
                points: [
                  {
                    eventCount: 1,
                    observedAt: "2026-08-20T11:00:00.000Z",
                    status: "degraded",
                  },
                ],
              },
            ],
          }
        : {
            items: [
              {
                id: "event-1",
                monitorId: "http",
                observedAt: "2026-08-20T10:00:00.000Z",
                receivedAt: "2026-08-20T10:00:01.000Z",
                source: "monitor:http",
                status: "healthy",
              },
              {
                id: "event-2",
                monitorId: "database",
                observedAt: "2026-08-20T11:00:00.000Z",
                receivedAt: "2026-08-20T11:00:01.000Z",
                source: "monitor:database",
                status: "degraded",
              },
            ],
            meta: { total: 2 },
          };
      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    };
    const dialogRoot = mountRuntimeMonitoringDialog(
      document.getElementById("app"),
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    const chartButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent.includes("Gráfico"),
    );
    assert.ok(chartButton);
    assert.equal(chartButton.getAttribute("aria-pressed"), "true");
    const [observedFromInput, observedToInput] = document.querySelectorAll(
      '.homeMonitoringFilters input[type="datetime-local"]',
    );
    assert.match(observedFromInput.value, /T00:00$/u);
    assert.ok(observedToInput.value);
    assert.ok(
      document.querySelector(
        '[aria-label="Evolução temporal da saúde por monitoramento"]',
      ),
    );
    assert.match(document.body.textContent, /2 eventos resumidos em 2 pontos/u);

    const listButton = [...document.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Lista"),
    );
    listButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(
      document.querySelectorAll(".homeMonitoringSignals article").length,
      2,
    );
    dialogRoot.unmount();
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
