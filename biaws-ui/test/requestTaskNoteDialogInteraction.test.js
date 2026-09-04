import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("task execution note opens in markdown editing mode", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "biaws-task-note-ui-"));
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
            "test/fixtures/RequestTaskNoteDialogHarness.jsx",
          ),
          fileName: "request-task-note-dialog-harness",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { mountRequestTaskNoteDialog } = await import(
      pathToFileURL(
        join(outputDirectory, "request-task-note-dialog-harness.js"),
      )
    );
    const harness = mountRequestTaskNoteDialog(document.getElementById("app"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const editor = document.querySelector(
      ".requestTaskNoteContentField textarea",
    );
    assert.ok(editor);
    assert.equal(
      document
        .querySelector('[aria-label="Editar texto"]')
        .getAttribute("aria-pressed"),
      "true",
    );

    editor.value = "**Nota em Markdown**";
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(editor.value, "**Nota em Markdown**");
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
