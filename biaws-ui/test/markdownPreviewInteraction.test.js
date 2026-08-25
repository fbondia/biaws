import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("code block can be copied without opening the fullscreen dialog", async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), "biaws-markdown-ui-"));
  const dom = new JSDOM("<!doctype html><div id=app></div>", {
    url: "https://biaws.example.test",
  });
  const copiedValues = [];
  Object.defineProperty(dom.window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (value) => copiedValues.push(value) },
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
            "test/fixtures/MarkdownPreviewHarness.jsx",
          ),
          fileName: "markdown-preview-harness",
          formats: ["es"],
        },
        outDir: outputDirectory,
      },
    });
    const { mountMarkdownPreview } = await import(
      pathToFileURL(join(outputDirectory, "markdown-preview-harness.js"))
    );
    const source = "const answer = 42;";
    const harness = mountMarkdownPreview(
      document.getElementById("app"),
      `\`\`\`js\n${source}\n\`\`\``,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const copyButton = document.querySelector(".markdownBlockCopyButton");
    assert.ok(copyButton);
    assert.equal(document.querySelector('[role="dialog"]'), null);

    copyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(copiedValues, [source]);
    assert.equal(copyButton.getAttribute("aria-label"), "Código copiado");
    assert.equal(document.querySelector('[role="dialog"]'), null);
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
