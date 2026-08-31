import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("server overview presents technical data, tags, purpose and markdown description", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "biaws-server-ui-"));
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
          entry: join(process.cwd(), "test/fixtures/ServerOverviewHarness.jsx"),
          fileName: "server-overview-harness",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { mountServerOverview } = await import(
      pathToFileURL(join(outputDirectory, "server-overview-harness.js"))
    );
    const root = mountServerOverview(document.getElementById("app"));
    const overview = document.querySelector(".serverOverviewCard");

    assert.ok(overview);
    assert.doesNotMatch(overview.textContent, /Inventário/u);
    assert.deepEqual(
      [...overview.querySelectorAll("dt")].map(
        ({ textContent }) => textContent,
      ),
      [
        "Hostname",
        "IPs",
        "Status",
        "Localização",
        "Provedor",
        "Sistema operacional",
        "Tags",
        "Finalidade",
      ],
    );
    assert.deepEqual(
      [...overview.querySelectorAll(".serverTagChip")].map(
        ({ textContent }) => textContent,
      ),
      ["produção", "crítico"],
    );
    assert.equal(
      overview.querySelector(".serverOverviewPurpose dd").textContent,
      "Hospeda os serviços principais.",
    );
    assert.equal(
      overview.querySelector(".serverOverviewDescription strong").textContent,
      "monitorado",
    );
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
