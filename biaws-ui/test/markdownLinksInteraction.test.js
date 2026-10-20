import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, afterEach, before, test } from "node:test";
import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

let dom, output, module, harness, previous, previousNodeEnv;
before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  output = await mkdtemp(join(tmpdir(), "biaws-markdown-links-"));
  dom = new JSDOM("<div id=app></div>", { url: "https://biaws.example.test" });
  previous = Object.fromEntries(
    ["document", "navigator", "window", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const key of ["document", "navigator", "window"])
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  await symlink(join(process.cwd(), "node_modules"), join(output, "node_modules"), "dir");
  await build({
    configFile: false,
    logLevel: "silent",
    plugins: [react()],
    define: { "process.env.NODE_ENV": '"development"' },
    build: {
      emptyOutDir: false,
      rollupOptions: { external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"] },
      lib: {
        entry: join(process.cwd(), "test/fixtures/MarkdownPreviewHarness.jsx"),
        fileName: "preview",
        formats: ["cjs"],
      },
      outDir: output,
    },
  });
  module = (await import(pathToFileURL(join(output, "preview.cjs")))).default;
});
afterEach(async () => {
  if (!harness) return;
  await module.act(async () => {
    harness.root.unmount();
    harness.dispose();
  });
  harness = null;
});
after(async () => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  for (const [key, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
  dom.window.close();
  await rm(output, { recursive: true, force: true });
});
async function mount(source) {
  await module.act(async () => {
    harness = module.mountMarkdownPreview(document.getElementById("app"), source);
  });
}
async function click(element, options = {}) {
  let event;
  await module.act(async () => {
    element.focus();
    event = new window.MouseEvent(options.type || "click", { bubbles: true, cancelable: true, ...options });
    element.dispatchEvent(event);
  });
  return event;
}
function button(label) {
  return [...document.querySelectorAll("button")].find((item) => item.textContent.trim() === label);
}

test("auto and explicit links show the risk warning before opening and canceling keeps the page", async (t) => {
  const open = t.mock.method(window, "open", () => null);
  await mount("https://example.test/path?q=1&x=2\n\n[Site](https://example.test/explicit)");
  for (const link of document.querySelectorAll("a")) {
    assert.equal(link.target, "_blank");
    assert.equal(link.rel, "noreferrer");
    const event = await click(link);
    assert.equal(event.defaultPrevented, true);
    assert.equal(open.mock.callCount(), 0);
    const dialog = document.querySelector('[role="dialog"]');
    assert.match(dialog.textContent, /sites maliciosos, golpes ou downloads perigosos/u);
    assert.ok(dialog.textContent.includes(link.href));
    assert.equal(document.activeElement.textContent, "Cancelar");
    await click(button("Cancelar"));
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(open.mock.callCount(), 0);
    assert.equal(document.activeElement, link);
  }
});

test("confirming opens exactly the displayed destination with an isolated new window", async (t) => {
  const open = t.mock.method(window, "open", () => null);
  await mount("www.example.test/path");
  const link = document.querySelector("a");
  await click(link);
  await click(link);
  assert.equal(open.mock.callCount(), 0);
  await click(button("Abrir link"));
  assert.deepEqual(
    open.mock.calls.map(({ arguments: args }) => args),
    [["https://www.example.test/path", "_blank", "noopener,noreferrer"]],
  );
  assert.equal(document.querySelector('[role="dialog"]'), null);
});

test("middle and modified clicks also require confirmation", async (t) => {
  const open = t.mock.method(window, "open", () => null);
  await mount("https://example.test");
  const link = document.querySelector("a");
  for (const options of [{ type: "auxclick", button: 1 }, { ctrlKey: true }, { metaKey: true }]) {
    assert.equal((await click(link, options)).defaultPrevented, true);
    assert.ok(button("Abrir link"));
    await click(button("Cancelar"));
  }
  assert.equal(open.mock.callCount(), 0);
});

test("removing a preview before confirmation cannot navigate from a stale link", async (t) => {
  const open = t.mock.method(window, "open", () => null);
  await mount("https://example.test");
  await click(document.querySelector("a"));
  await module.act(async () => harness.update("Conteúdo substituído"));
  await click(button("Abrir link"));
  assert.equal(open.mock.callCount(), 0);
});
