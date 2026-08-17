import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("new option keeps input focus while its value is typed", async () => {
  const outputDirectory = await mkdtemp(
    join(tmpdir(), "biaws-option-list-ui-"),
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
            "test/fixtures/OptionListEditorHarness.jsx",
          ),
          fileName: "option-list-editor-harness",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { mountOptionListEditor } = await import(
      pathToFileURL(join(outputDirectory, "option-list-editor-harness.js"))
    );
    const harness = mountOptionListEditor(document.getElementById("app"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    [...document.querySelectorAll("button")]
      .find((button) => button.textContent.includes("Adicionar opção"))
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const valueInput = document.querySelector(
      ".optionListTable tbody tr:last-child td:nth-child(2) input",
    );
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set;
    valueInput.focus();

    for (const value of ["r", "re", "req", "requ"]) {
      valueSetter.call(valueInput, value);
      valueInput.dispatchEvent(new window.Event("input", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(document.activeElement, valueInput);
    }

    assert.equal(valueInput.value, "requ");
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
