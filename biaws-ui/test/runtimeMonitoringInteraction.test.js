import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("runtime monitoring supports provider forms, nested tabs and paged history", async () => {
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
    const { mountRuntimeMonitoring, mountRuntimeMonitoringTabs } = await import(
      pathToFileURL(join(outputDirectory, "runtime-monitoring-harness.js"))
    );
    const root = mountRuntimeMonitoring(document.getElementById("app"));

    const createButton = [...document.querySelectorAll("button")].find(
      (button) => button.textContent.includes("Novo monitoramento"),
    );
    assert.ok(createButton);
    createButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    let dialog = document.querySelector('[role="dialog"]');
    assert.ok(dialog);
    assert.match(dialog.textContent, /Como deseja monitorar/u);
    assert.match(dialog.textContent, /API REST/u);
    assert.match(dialog.textContent, /Shell Script/u);
    assert.match(dialog.textContent, /Manual/u);

    const manualChoice = [...dialog.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Manual"),
    );
    manualChoice.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dialog = document.querySelector('[role="dialog"]');
    assert.match(dialog.textContent, /BIAWS não agenda uma execução/u);
    assert.match(dialog.textContent, /Exemplo com curl/u);
    assert.match(dialog.textContent, /Comando BIAWS CLI/u);

    const backButton = [...dialog.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Voltar"),
    );
    backButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dialog = document.querySelector('[role="dialog"]');
    const restChoice = [...dialog.querySelectorAll("button")].find((button) =>
      button.textContent.includes("API REST"),
    );
    restChoice.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dialog = document.querySelector('[role="dialog"]');
    assert.match(dialog.textContent, /URL HTTP\(S\), sem credenciais/u);
    assert.equal(dialog.querySelector('select[name="provider"]'), null);
    assert.ok(dialog.querySelector("#active-monitor-dialog-title svg"));
    assert.deepEqual(
      [...dialog.querySelectorAll(".catalogMonitorFormSection h3")].map(
        (heading) => heading.textContent,
      ),
      ["Identificação", "Agendamento", "Requisição REST", "Interpretação"],
    );
    const templateSelect = dialog.querySelector('select[name="templateId"]');
    const versionSelect = dialog.querySelector(
      'select[name="templateVersion"]',
    );
    assert.ok(templateSelect);
    assert.equal(versionSelect.disabled, true);
    templateSelect.value = "health-template";
    templateSelect.dispatchEvent(
      new dom.window.Event("change", { bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(versionSelect.disabled, false);
    assert.deepEqual(
      [...versionSelect.options].map((option) => option.value),
      ["", "2"],
    );
    assert.equal(dialog.querySelector('input[name="templateId"]'), null);

    const cancelButton = [...dialog.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Cancelar"),
    );
    cancelButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    createButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dialog = document.querySelector('[role="dialog"]');
    const shellChoice = [...dialog.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Shell Script"),
    );
    shellChoice.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dialog = document.querySelector('[role="dialog"]');
    assert.match(dialog.textContent, /ID do script permitido/u);
    assert.doesNotMatch(dialog.textContent, /URL HTTP\(S\), sem credenciais/u);
    assert.match(dialog.textContent, /Execução do script/u);

    root.unmount();

    const tabsRoot = mountRuntimeMonitoringTabs(document.getElementById("app"));
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    assert.deepEqual(
      tabs.map((tab) => tab.textContent),
      ["Configurações", "Histórico"],
    );
    assert.match(document.body.textContent, /Conteúdo de configurações/u);

    tabs[1].click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.match(document.body.textContent, /Histórico unificado/u);
    const loadMore = [...document.querySelectorAll("button")].find((button) =>
      button.textContent.includes("Carregar mais"),
    );
    assert.ok(loadMore);
    loadMore.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(document.querySelectorAll(".catalogHistoryItem").length, 2);
    assert.doesNotMatch(document.body.textContent, /Carregar mais/u);

    tabsRoot.unmount();
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
