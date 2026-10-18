import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, afterEach, before, test } from "node:test";
import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

let dom, output, harnessModule, harness, previous, previousNodeEnv;
before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  output = await mkdtemp(join(tmpdir(), "biaws-catalog-ui-"));
  dom = new JSDOM("<div id=app></div>", { url: "https://biaws.example.test" });
  previous = Object.fromEntries(
    ["document", "navigator", "window", "fetch", "IS_REACT_ACT_ENVIRONMENT"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const key of ["document", "navigator", "window"])
    Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async () => Response.json({ items: [], meta: { totalPages: 1 } });
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
        entry: join(process.cwd(), "test/fixtures/MarkdownAttachmentsHarness.jsx"),
        fileName: "catalog",
        formats: ["cjs"],
      },
      outDir: output,
    },
  });
  harnessModule = (await import(pathToFileURL(join(output, "catalog.cjs")))).default;
});
afterEach(async () => {
  if (harness) {
    await harnessModule.act(async () => harness.root.unmount());
    harness.resetSession();
    harness = null;
  }
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
async function mount(document, props = {}) {
  await harnessModule.act(async () => {
    harness = harnessModule.mountDocumentDetail(globalThis.document.getElementById("app"), document, props);
  });
}
async function click(element) {
  assert.ok(element);
  await harnessModule.act(async () => element.click());
}
const button = (label) =>
  [...document.querySelectorAll("button")].find(
    (element) => element.getAttribute("aria-label") === label || element.textContent.trim() === label,
  );
async function type(label, value) {
  const input = document.querySelector(`[aria-label="${label}"]`);
  assert.ok(input);
  await harnessModule.act(async () => {
    const prototype =
      input.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(input, value);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}
const catalog = {
  id: "catalog-one",
  documentType: "catalog",
  title: "Serviços",
  markdown: "",
  details: {
    items: [
      { id: "api", title: "API", description: "**Contrato**\n\n- GET /status" },
      { id: "worker", title: "Worker", description: "Processamento assíncrono" },
    ],
  },
};

test("catalog reading expands and collapses each entry independently and renders Markdown", async () => {
  await mount(catalog);
  const items = [...document.querySelectorAll(".knowledgeCatalogItem")];
  assert.equal(items.length, 2);
  assert.equal(items[0].open, false);
  await click(items[0].querySelector("summary"));
  assert.equal(items[0].open, true);
  assert.equal(items[1].open, false);
  assert.equal(items[0].querySelector("strong").textContent, "Contrato");
  assert.equal(items[0].querySelector("li").textContent, "GET /status");
  await click(items[0].querySelector("summary"));
  assert.equal(items[0].open, false);
});

test("catalog editing adds, renames and removes entries without losing other descriptions", async () => {
  await mount(catalog);
  await click(button("Detalhes"));
  assert.equal(document.body.textContent.includes("Natureza da referência"), false);
  await click(button("Conteúdo"));
  await click(button("Adicionar elemento"));
  await type("Título do elemento 3", "Fila");
  await type("Descrição do elemento 3", "## Eventos\n\n**Entrega garantida**");
  await click(button("Remover elemento 1"));
  assert.equal(document.querySelector('[aria-label="Título do elemento 1"]').value, "Worker");
  assert.equal(document.querySelector('[aria-label="Título do elemento 2"]').value, "Fila");
  assert.equal(
    document.querySelector('[aria-label="Descrição do elemento 2"]').value,
    "## Eventos\n\n**Entrega garantida**",
  );
  await click(button("Fechar detalhes"));
  const summaries = [...document.querySelectorAll(".knowledgeCatalogItem > summary")].map((item) => item.textContent);
  assert.deepEqual(summaries, ["Worker", "Fila"]);
  assert.equal(document.querySelector(".knowledgeCatalogItems strong").textContent, "Entrega garantida");
});

test("free text starts with blank Markdown and no type-specific details", async () => {
  await mount({ documentType: "free-text", title: "Anotações" });
  assert.equal(document.body.textContent.includes("Detalhes Adicionais"), false);
  await click(button("Conteúdo"));
  assert.equal(document.querySelector("textarea").value, "");
  await type("Conteúdo do documento", "## Livre\n\nSem modelo obrigatório.");
  await click(button("Visualizar conteúdo"));
  assert.equal(document.querySelector(".markdownPreview h2").textContent, "Livre");
});

test("read-only catalog details do not expose editors or item mutations", async () => {
  await mount(catalog, { canUpdate: false });
  await click(button("Detalhes"));
  await click(button("Conteúdo"));
  assert.equal(button("Adicionar elemento"), undefined);
  assert.equal(button("Remover elemento 1"), undefined);
  assert.equal(document.querySelector("textarea"), null);
  const item = document.querySelector(".knowledgeDetailsDialog .knowledgeCatalogItem");
  await click(item.querySelector("summary"));
  assert.equal(item.open, true);
});

test("catalog exports include all collapsed descriptions in Markdown and printable PDF", async (t) => {
  let download, printable;
  t.mock.method(URL, "createObjectURL", (blob) => {
    download = blob;
    return "blob:catalog-export";
  });
  t.mock.method(URL, "revokeObjectURL", () => {});
  t.mock.method(window.HTMLAnchorElement.prototype, "click", () => {});
  t.mock.method(document.body, "append", (frame) => {
    printable = frame.srcdoc;
  });
  await mount(catalog);
  await click(button("Detalhes"));
  await click(button("Exportar documento"));
  await click(
    [...document.querySelectorAll(".knowledgeDocumentActionOption")].find(
      (option) => option.querySelector("strong").textContent === "Markdown",
    ),
  );
  assert.equal(
    await download.text(),
    "## API\n\n**Contrato**\n\n- GET /status\n\n## Worker\n\nProcessamento assíncrono",
  );
  await click(button("Exportar documento"));
  await click(
    [...document.querySelectorAll(".knowledgeDocumentActionOption")].find(
      (option) => option.querySelector("strong").textContent === "PDF",
    ),
  );
  const printDom = new JSDOM(printable);
  const entries = [...printDom.window.document.querySelectorAll("details")];
  assert.equal(entries.length, 2);
  assert.equal(
    entries.every((entry) => entry.open),
    true,
  );
  assert.ok(printDom.window.document.body.textContent.includes("Processamento assíncrono"));
  assert.equal(document.querySelector(".knowledgeDocumentReading details").open, false);
  printDom.window.close();
});
