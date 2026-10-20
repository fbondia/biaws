import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
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
  const style = dom.window.document.createElement("style");
  style.textContent = (
    await Promise.all(
      ["foundations/tokens.css", "shared/filter-dialogs.css", "features/knowledge/details.css"].map((file) =>
        readFile(join(process.cwd(), "src/styles", file), "utf8"),
      ),
    )
  ).join("\n");
  dom.window.document.head.append(style);
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
  await harnessModule.act(async () => {
    element.focus();
    element.click();
  });
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

test("export options open above document details and closing them preserves the document", async () => {
  await mount(catalog);
  await click(button("Detalhes"));
  await click(button("Exportar documento"));
  const dialog = document.querySelector('[role="dialog"][aria-label="Exportar documento"]');
  const details = document.querySelector(".knowledgeDetailsDialog");
  assert.ok(dialog);
  assert.ok(details);
  function stackingLevel(element) {
    // JSDOM exposes custom property references without resolving them.
    const value = window.getComputedStyle(element).zIndex;
    return Number(
      value.replace(/var\((--[\w-]+)\)/gu, (_, token) =>
        window.getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
      ),
    );
  }
  assert.ok(stackingLevel(dialog.parentElement) > stackingLevel(details.parentElement));
  assert.deepEqual(
    [...dialog.querySelectorAll(".knowledgeDocumentActionOption strong")].map((item) => item.textContent),
    ["Markdown", "PDF"],
  );
  await click(button("Fechar exportação"));
  assert.equal(document.querySelector('[role="dialog"][aria-label="Exportar documento"]'), null);
  assert.ok(document.querySelector(".knowledgeDetailsDialog"));
});

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
  const editor = document.querySelector(".knowledgeDetailsDialog .knowledgeCatalogEditor");
  assert.equal(
    [...editor.querySelectorAll("details")].every((item) => !item.open),
    true,
  );
  const actions = editor.querySelector("summary [role=group]");
  assert.deepEqual(
    [...actions.querySelectorAll("button")].map((item) => item.getAttribute("aria-label")),
    [
      "Mover elemento 1 acima",
      "Mover elemento 1 abaixo",
      "Aninhar elemento 1",
      "Mover elemento 1 para o nível acima",
      "Arrastar elemento 1",
    ],
  );
  await click(button("Arrastar elemento 1"));
  assert.equal(editor.querySelector("details").open, false);
  await click(button("Adicionar elemento"));
  const added = editor.querySelectorAll(":scope > .knowledgeCatalogItems > details")[0];
  assert.equal(added.open, true);
  assert.equal(document.activeElement, added.querySelector("input"));
  assert.equal(
    [...editor.querySelectorAll("details")].filter((item) => item !== added).every((item) => !item.open),
    true,
  );
  await type("Título do elemento 1", "Fila");
  const description = added.querySelector("textarea");
  description.focus();
  await type("Descrição do elemento 1", "## Eventos\n\n**Entrega garantida**");
  assert.equal(document.activeElement, description);
  await click(editor.querySelectorAll(":scope > .knowledgeCatalogItems > details")[1].querySelector("summary"));
  await click(button("Remover elemento 2"));
  assert.equal(document.querySelector('[aria-label="Título do elemento 2"]').value, "Worker");
  assert.equal(document.querySelector('[aria-label="Título do elemento 1"]').value, "Fila");
  assert.equal(
    document.querySelector('[aria-label="Descrição do elemento 1"]').value,
    "## Eventos\n\n**Entrega garantida**",
  );
  await click(button("Fechar detalhes"));
  const summaries = [...document.querySelectorAll(".knowledgeCatalogItem > summary")].map((item) => item.textContent);
  assert.deepEqual(summaries, ["Fila", "Worker"]);
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

async function select(label, value) {
  const element = document.querySelector(`[aria-label="${label}"]`);
  assert.ok(element);
  await harnessModule.act(async () => {
    element.value = value;
    element.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}
async function drag(handle, target) {
  const dataTransfer = { setData() {}, effectAllowed: "", dropEffect: "" };
  await harnessModule.act(async () => {
    const start = new window.Event("dragstart", { bubbles: true });
    Object.defineProperty(start, "dataTransfer", { value: dataTransfer });
    handle.dispatchEvent(start);
  });
  const dropTarget = target();
  assert.ok(dropTarget);
  await harnessModule.act(async () => {
    for (const type of ["dragover", "drop"]) {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
      dropTarget.dispatchEvent(event);
    }
  });
}

test("conversion button opens a focused dialog and sends the selected target and metadata policy", async () => {
  const calls = [];
  await mount(
    {
      id: "rule-one",
      documentType: "business-rule",
      title: "Regra",
      applicationId: "app-one",
      details: { ruleCode: "RN-1" },
      markdown: "Regra",
    },
    { onConvert: async (options) => calls.push(options) },
  );
  await click(button("Detalhes"));
  await click(button("Trocar tipo de documento"));
  assert.equal(document.activeElement.getAttribute("aria-label"), "Tipo de destino");
  assert.equal(button("Converter documento").disabled, true);
  await select("Tipo de destino", "free-text");
  await click(
    [...document.querySelectorAll(".knowledgeConversionDialog label")]
      .find((element) => element.textContent.includes("Descartar os dados adicionais"))
      .querySelector("input"),
  );
  await click(button("Converter documento"));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].targetType, "free-text");
  assert.equal(calls[0].additionalData, "discard");
  assert.equal(document.querySelector(".knowledgeConversionDialog"), null);
});

test("catalog target offers conversion or incorporation and loads only other active catalogs", async () => {
  const calls = [];
  let catalogRequests = 0;
  globalThis.fetch = async (url) => {
    if (url.searchParams.get("documentType") === "catalog") {
      catalogRequests += 1;
      return Response.json({
        items: [
          catalog,
          { id: "target", documentType: "catalog", title: "Destino" },
          { id: "archived", status: "archived", title: "Arquivo" },
        ],
        meta: { totalPages: 1 },
      });
    }
    return Response.json({ items: [], meta: { totalPages: 1 } });
  };
  await mount(catalog, { onConvert: async (options) => calls.push(options) });
  await click(button("Detalhes"));
  await click(button("Trocar tipo de documento"));
  await select("Tipo de destino", "catalog");
  assert.equal(catalogRequests, 1);
  const target = document.querySelector('[aria-label="Catálogo de destino"]');
  assert.deepEqual(
    [...target.options].map(({ value }) => value),
    ["", "target"],
  );
  await select("Catálogo de destino", "target");
  await click(button("Incorporar ao catálogo"));
  assert.deepEqual(calls[0], {
    targetType: "catalog",
    additionalData: "append",
    mode: "catalog-item",
    targetCatalogId: "target",
  });
});

test("conversion reports errors, requires the target application, and closes on Escape", async () => {
  await mount(
    { id: "text-one", documentType: "free-text", title: "Notas", markdown: "Texto" },
    {
      onConvert: async () => {
        throw new Error("Destino sem permissão");
      },
      catalog: { applications: [{ id: "app-one", name: "Aplicação" }], components: [] },
    },
  );
  await click(button("Detalhes"));
  await click(button("Trocar tipo de documento"));
  await select("Tipo de destino", "business-rule");
  assert.equal(button("Converter documento").disabled, true);
  await select("Aplicação do documento", "app-one");
  await click(button("Converter documento"));
  assert.equal(document.querySelector(".knowledgeConversionDialog [role=alert]").textContent, "Destino sem permissão");
  await harnessModule.act(async () =>
    document
      .querySelector(".knowledgeConversionDialog")
      .dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
  );
  assert.equal(document.querySelector(".knowledgeConversionDialog"), null);
  assert.equal(document.activeElement.getAttribute("aria-label"), "Trocar tipo de documento");
});

test("catalog drag nests an item and preserves its text when moving it back to root", async () => {
  await mount(catalog);
  await click(button("Detalhes"));
  await click(button("Conteúdo"));
  await drag(button("Arrastar elemento 2"), () =>
    document.querySelector(".knowledgeDetailsDialog .knowledgeCatalogSummary"),
  );
  const editor = document.querySelector(".knowledgeDetailsDialog .knowledgeCatalogEditor");
  assert.equal(editor.querySelectorAll(":scope > .knowledgeCatalogItems > details").length, 1);
  assert.equal(editor.querySelector("details").open, false);
  await click(editor.querySelector("details > summary"));
  assert.equal(editor.querySelector("details details input").value, "Worker");
  assert.equal(editor.querySelector("details details textarea").value, "Processamento assíncrono");
  await drag(button("Arrastar elemento 2"), () =>
    [...editor.querySelectorAll('[aria-label="Mover para a raiz do catálogo"]')].at(-1),
  );
  assert.equal(editor.querySelectorAll(":scope > .knowledgeCatalogItems > details").length, 2);
  assert.equal(editor.querySelectorAll(":scope > .knowledgeCatalogItems > details")[1].open, false);
  await click(button("Aninhar elemento 2"));
  assert.equal(editor.querySelector("details details").open, false);
  await click(button("Mover elemento 2 para o nível acima"));
  assert.equal(editor.querySelectorAll(":scope > .knowledgeCatalogItems > details").length, 2);
});

test("catalog descriptions can be hidden beside the title input without losing their content", async () => {
  await mount(catalog);
  await click(button("Detalhes"));
  await click(button("Conteúdo"));
  const editor = document.querySelector(".knowledgeDetailsDialog .knowledgeCatalogEditor");
  const first = editor.querySelector("details");
  assert.equal(first.querySelector("summary .knowledgeCatalogDescriptionToggle"), null);
  const titleEditor = first.querySelector(".knowledgeCatalogTitleEditor");
  assert.ok(titleEditor.querySelector('input[aria-label="Título do elemento 1"]'));
  assert.ok(titleEditor.querySelector(".knowledgeCatalogDescriptionToggle"));
  assert.ok(titleEditor.querySelector('[aria-label="Adicionar subitem"]'));
  assert.ok(titleEditor.querySelector('[aria-label="Remover elemento 1"]'));
  assert.equal(
    [...titleEditor.querySelectorAll("button")].every((item) => !item.textContent.trim()),
    true,
  );
  await click(first.querySelector("summary"));
  await click(button("Ocultar descrição do elemento 1"));
  assert.equal(first.open, true);
  assert.equal(editor.querySelector('[aria-label="Descrição do elemento 1"]'), null);
  assert.equal(button("Exibir descrição do elemento 1").getAttribute("aria-pressed"), "true");
  await click(button("Exibir descrição do elemento 1"));
  assert.equal(editor.querySelector('[aria-label="Descrição do elemento 1"]').value, "**Contrato**\n\n- GET /status");
  await click(button("Ocultar descrição do elemento 1"));
  await click(button("Fechar detalhes"));
  const reading = document.querySelector(".knowledgeDocumentReading .knowledgeCatalogItem");
  await click(reading.querySelector("summary"));
  assert.equal(reading.querySelector(".markdownPreview"), null);
});

test("new subitems are inserted before existing siblings and may omit descriptions", async () => {
  await mount({
    ...catalog,
    details: {
      items: [...catalog.details.items, { id: "child", parentId: "api", title: "Existente", description: "" }],
    },
  });
  await click(button("Detalhes"));
  await click(button("Conteúdo"));
  const editor = document.querySelector(".knowledgeDetailsDialog .knowledgeCatalogEditor");
  await click(editor.querySelector("details > summary"));
  await click(button("Adicionar subitem"));
  const children = [...editor.querySelectorAll("details details")];
  assert.equal(children.length, 2);
  assert.equal(children[0].querySelector("input").value, "");
  assert.equal(children[1].querySelector("input").value, "Existente");
  assert.equal(children[0].open, true);
  assert.equal(document.activeElement, children[0].querySelector("input"));
  assert.equal(children[1].open, false);
});
