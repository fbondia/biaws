import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

const image = { id: "image-one", filename: "captura.png", contentType: "image/png" };
const pdf = { id: "pdf-one", filename: "manual.pdf", contentType: "application/pdf" };
const imported = { index: 0, filename: "dados.csv", contentType: "text/csv" };
const attachments = [image, pdf, imported];
let dom;
let outputDirectory;
let harnessModule;
let previous;
let previousUrls;
let previousNodeEnv;
const createdUrls = [];
const revokedUrls = [];
const downloads = [];

before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  outputDirectory = await mkdtemp(join(tmpdir(), "biaws-markdown-attachments-ui-"));
  dom = new JSDOM("<!doctype html><div id=app></div>", { url: "https://biaws.example.test" });
  previous = Object.fromEntries(
    ["document", "navigator", "window", "fetch"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  for (const name of ["document", "navigator", "window"]) {
    Object.defineProperty(globalThis, name, { configurable: true, value: dom.window[name] });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  previousUrls = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
  URL.createObjectURL = (blob) => {
    const url = `blob:synthetic-file-${createdUrls.length}`;
    createdUrls.push({ url, blob });
    return url;
  };
  URL.revokeObjectURL = (url) => revokedUrls.push(url);
  dom.window.HTMLAnchorElement.prototype.click = function () {
    downloads.push({ href: this.href, filename: this.download });
  };
  await symlink(join(process.cwd(), "node_modules"), join(outputDirectory, "node_modules"), "dir");
  await build({
    configFile: false,
    logLevel: "silent",
    plugins: [react()],
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    build: {
      emptyOutDir: false,
      rollupOptions: { external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"] },
      lib: {
        entry: join(process.cwd(), "test/fixtures/MarkdownAttachmentsHarness.jsx"),
        fileName: "markdown-attachments-harness",
        formats: ["cjs"],
      },
      outDir: outputDirectory,
    },
  });
  harnessModule = (await import(pathToFileURL(join(outputDirectory, "markdown-attachments-harness.cjs")))).default;
});

after(async () => {
  if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = previousNodeEnv;
  for (const [name, descriptor] of Object.entries(previous)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  Object.assign(URL, previousUrls);
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  dom.window.close();
  await rm(outputDirectory, { force: true, recursive: true });
});

async function click(element) {
  assert.ok(element);
  await harnessModule.act(async () => element.click());
}

function button(text, scope = document) {
  const element = [...scope.querySelectorAll("button")].find((item) => item.textContent.trim() === text);
  assert.ok(element, `Button not found: ${text}`);
  return element;
}

async function selectAttachment(id, scope = document, label = "Inserir link para anexo") {
  const select = scope.querySelector(`[aria-label="${label}"]`);
  assert.ok(select);
  await harnessModule.act(async () => {
    select.value = id;
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}

test("editor inserts every file type at the selection and keeps downloads available in fullscreen", async () => {
  let harness;
  const loaded = [];
  await harnessModule.act(async () => {
    harness = harnessModule.mountMarkdownEditor(document.getElementById("app"), "Antes substituir depois", {
      attachments,
      initialMode: "text",
      onLoadAttachment: async (attachment) => {
        loaded.push(attachment);
        return new Blob(["synthetic-pdf"], { type: attachment.contentType });
      },
    });
  });
  try {
    const select = document.querySelector('[aria-label="Inserir link para anexo"]');
    assert.equal(select.options.length, 4);
    assert.equal(document.querySelector('[aria-label="Inserir imagem de anexo"]').options.length, 2);
    const textarea = document.querySelector("textarea");
    textarea.focus();
    textarea.setSelectionRange(6, 16);
    await selectAttachment(pdf.id);
    assert.equal(textarea.value, "Antes [manual.pdf](attachment:pdf-one) depois");
    assert.equal(document.activeElement, textarea);
    assert.equal(textarea.selectionStart, 38);
    assert.deepEqual(loaded, []);
    await click(document.querySelector('[aria-label="Editar em tela cheia"]'));
    const fullscreen = document.querySelector(".markdownFullscreenDialog");
    await selectAttachment("0", fullscreen);
    assert.match(fullscreen.querySelector("textarea").value, /\[dados.csv\]\(attachment:0\)/u);
    await click(fullscreen.querySelector('[aria-label="Visualizar conteúdo"]'));
    await click(button("manual.pdf", fullscreen));
    assert.deepEqual(loaded, [pdf]);
    assert.equal(downloads.at(-1).filename, pdf.filename);
    assert.ok(revokedUrls.includes(downloads.at(-1).href));
  } finally {
    await harnessModule.act(async () => harness.root.unmount());
  }
});

test("attachment links load on demand, report failure, allow retry and leave unavailable references as text", async () => {
  let harness;
  let attempts = 0;
  await harnessModule.act(async () => {
    harness = harnessModule.mountMarkdownPreview(
      document.getElementById("app"),
      "# [Manual](attachment:pdf-one)\n\n- [CSV](attachment:0)\n\n> [Imagem](attachment:image-one)\n\n[Ausente](attachment:missing) [Ajuda](https://example.test) `[Manual](attachment:pdf-one)`",
      {
        attachments,
        onLoadAttachment: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("HTTP 403");
          return new Blob(["synthetic-file"]);
        },
      },
    );
  });
  try {
    assert.equal(attempts, 0);
    assert.equal(document.querySelectorAll(".markdownAttachmentLink").length, 3);
    assert.equal(document.querySelector("a").href, "https://example.test/");
    assert.match(document.body.textContent, /\[Ausente\]\(attachment:missing\)/u);
    assert.equal(document.querySelector("code").textContent, "[Manual](attachment:pdf-one)");
    await click(button("Manual"));
    assert.match(document.querySelector('[role="status"]').textContent, /Tente novamente/u);
    assert.equal(button("Manual").disabled, false);
    await click(button("Manual"));
    assert.equal(document.querySelector('[role="status"]'), null);
    assert.equal(downloads.at(-1).filename, pdf.filename);
  } finally {
    await harnessModule.act(async () => harness.root.unmount());
  }
});

test("a pending download ignores repeat clicks and creates no URL after unmount", async () => {
  let resolve;
  let calls = 0;
  const request = new Promise((done) => {
    resolve = done;
  });
  let harness;
  const beforeUrls = createdUrls.length;
  await harnessModule.act(async () => {
    harness = harnessModule.mountMarkdownPreview(document.getElementById("app"), "[Manual](attachment:pdf-one)", {
      attachments,
      onLoadAttachment: () => {
        calls += 1;
        return request;
      },
    });
  });
  await click(button("Manual"));
  assert.equal(button("Manual").disabled, true);
  await click(button("Manual"));
  assert.equal(calls, 1);
  await harnessModule.act(async () => harness.root.unmount());
  await harnessModule.act(async () => resolve(new Blob(["synthetic-file"])));
  assert.equal(createdUrls.length, beforeUrls);
});

function mockDocumentApi(requests) {
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ path: url.pathname, options });
    if (url.pathname.includes("/attachments/"))
      return new Response("synthetic-file", { headers: { "Content-Type": "application/octet-stream" } });
    if (url.pathname.endsWith("/observations"))
      return Response.json({
        items: [{ id: "observation-one", createdAt: "2026-10-02T12:00:00Z", markdown: "[Manual](attachment:pdf-one)" }],
      });
    return Response.json({ items: [], meta: { totalPages: 1 } });
  };
}

test("document reading, content editor and observations resolve attachments through the authenticated workspace API", async () => {
  const requests = [];
  mockDocumentApi(requests);
  let harness;
  await harnessModule.act(async () => {
    harness = harnessModule.mountDocumentDetail(document.getElementById("app"), {
      id: "document-one",
      documentType: "procedure",
      title: "Documento sintético",
      status: "published",
      attachments,
      markdown: "![Captura](attachment:image-one)\n\n[Manual](attachment:pdf-one)",
    });
  });
  try {
    assert.equal(document.querySelector(".knowledgeDocumentReading img").alt, "Captura");
    assert.equal(requests.filter(({ path }) => path.endsWith("/attachments/pdf-one")).length, 0);
    await click(button("Manual"));
    const downloadRequest = requests.find(({ path }) => path.endsWith("/attachments/pdf-one"));
    assert.equal(downloadRequest.path, "/api/knowledge/documents/document-one/attachments/pdf-one");
    assert.equal(downloadRequest.options.credentials, "include");
    assert.equal(downloadRequest.options.headers["X-Biaws-Workspace-Id"], "synthetic-workspace");
    await click(button("Detalhes"));
    await click(button("Conteúdo"));
    const dialog = document.querySelector(".knowledgeDetailsDialog");
    assert.equal(dialog.querySelector("img").alt, "Captura");
    await selectAttachment("0", dialog);
    assert.match(dialog.querySelector("textarea").value, /\[dados.csv\]\(attachment:0\)/u);
    await click(dialog.querySelector('[aria-label="Visualizar conteúdo"]'));
    await click(button("dados.csv", dialog));
    assert.equal(downloads.at(-1).filename, imported.filename);
    await click(button("Observações", dialog));
    assert.ok(dialog.querySelector(".auditEventContent .markdownAttachmentLink"));
    await selectAttachment(image.id, dialog, "Inserir imagem de anexo");
    assert.equal(dialog.querySelector("textarea").value, "![captura.png](attachment:image-one)");
  } finally {
    await harnessModule.act(async () => harness.root.unmount());
    harness.resetSession();
  }
});

test("document attachment controls and content requests require attachment read permission", async () => {
  const requests = [];
  mockDocumentApi(requests);
  let harness;
  await harnessModule.act(async () => {
    harness = harnessModule.mountDocumentDetail(
      document.getElementById("app"),
      {
        id: "document-denied",
        documentType: "procedure",
        title: "Documento sintético",
        status: "published",
        attachments,
        markdown: "![Captura](attachment:image-one) [Manual](attachment:pdf-one)",
      },
      { canReadAttachments: false },
    );
  });
  try {
    assert.equal(document.querySelector("img"), null);
    assert.equal(document.querySelector(".markdownAttachmentLink"), null);
    await click(button("Detalhes"));
    await click(button("Conteúdo"));
    assert.equal(document.querySelector('[aria-label="Inserir link para anexo"]'), null);
    assert.equal(document.querySelector('[aria-label="Inserir imagem de anexo"]'), null);
    assert.equal(
      requests.some(({ path }) => path.includes("/attachments/")),
      false,
    );
  } finally {
    await harnessModule.act(async () => harness.root.unmount());
    harness.resetSession();
  }
});
