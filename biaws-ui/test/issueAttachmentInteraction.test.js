import assert from "node:assert/strict";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";

import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

const file = {
  id: "uploaded-image",
  index: 0,
  filename: "captura.png",
  contentType: "image/png",
  cid: "image@example.test",
};
let dom;
let outputDirectory;
let harnessModule;
let previous;
let previousUrls;
let createdUrls;
let revokedUrls;
let previousNodeEnv;

before(async () => {
  previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  outputDirectory = await mkdtemp(join(tmpdir(), "biaws-issue-attachments-ui-"));
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
  createdUrls = [];
  revokedUrls = [];
  previousUrls = { createObjectURL: URL.createObjectURL, revokeObjectURL: URL.revokeObjectURL };
  URL.createObjectURL = () => {
    const url = `blob:synthetic-image-${createdUrls.length}`;
    createdUrls.push(url);
    return url;
  };
  URL.revokeObjectURL = (url) => revokedUrls.push(url);
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
        entry: join(process.cwd(), "test/fixtures/IssueDetailsHarness.jsx"),
        fileName: "issue-details-harness",
        formats: ["cjs"],
      },
      outDir: outputDirectory,
    },
  });
  harnessModule = (await import(pathToFileURL(join(outputDirectory, "issue-details-harness.cjs")))).default;
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

async function changeField(element, value) {
  const prototype =
    element.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await harnessModule.act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value").set.call(element, value);
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
    element.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}

test("comment editing preserves unknown dates and complete timestamps when only text changes", async () => {
  for (const date of [null, "2026-07-30T13:42:15.123Z"]) {
    const issue = { id: "DATE-TEST", title: "Synthetic comment date test", text: "Description", attachments: [] };
    let comment = {
      _id: "comment-date",
      from: "Synthetic sender",
      date,
      createdAt: "2026-10-01T12:00:00Z",
      text: "Historical comment",
    };
    const bodies = [];
    globalThis.fetch = async (url, options = {}) => {
      if (url.pathname.endsWith("/taxonomy")) return Response.json({ taxonomy: { taxonomy: [], tagGroups: [] } });
      assert.equal(url.pathname, "/api/issues/DATE-TEST/comments/comment-date");
      const body = JSON.parse(options.body);
      bodies.push(body);
      comment = { ...comment, ...body };
      return Response.json({ issue, comments: [comment] });
    };
    let harness;
    await harnessModule.act(async () => {
      harness = harnessModule.mountIssueDetails(document.getElementById("app"), { issue, comments: [comment] });
    });
    try {
      await click(button("Comentários"));
      if (date === null)
        assert.match(document.querySelector(".commentItem header").textContent, /Data não identificada/u);
      await click(button("Editar"));
      const dialog = document.querySelector(".issueCommentDialog");
      assert.equal(dialog.querySelector('input[type="date"]').value, date ? "2026-07-30" : "");
      await click(dialog.querySelector('[aria-label="Editar texto"]'));
      await changeField(dialog.querySelector("textarea"), "Updated historical comment");
      assert.equal(button("Salvar comentário", dialog).disabled, false);
      await click(button("Salvar comentário", dialog));
      assert.deepEqual(bodies, [{ text: "Updated historical comment" }]);
      assert.equal(comment.date, date);
      if (date) {
        await click(button("Editar"));
        await changeField(document.querySelector('.issueCommentDialog input[type="date"]'), "");
        await click(button("Salvar comentário", document.querySelector(".issueCommentDialog")));
        assert.deepEqual(bodies[1], { text: "Updated historical comment", date: null });
        assert.match(document.querySelector(".commentItem header").textContent, /Data não identificada/u);
      }
    } finally {
      await harnessModule.act(async () => harness.root.unmount());
      harness.resetSession();
    }
  }
});

test("a new manual comment can be saved with an explicitly unknown date", async () => {
  const issue = { id: "NEW-DATE-TEST", title: "New synthetic comment", text: "Description", attachments: [] };
  let body;
  globalThis.fetch = async (url, options = {}) => {
    if (url.pathname.endsWith("/taxonomy")) return Response.json({ taxonomy: { taxonomy: [], tagGroups: [] } });
    assert.equal(url.pathname, "/api/issues/NEW-DATE-TEST/comments");
    body = JSON.parse(options.body);
    return Response.json({ issue, comments: [{ _id: "new-comment", ...body }] });
  };
  let harness;
  await harnessModule.act(async () => {
    harness = harnessModule.mountIssueDetails(document.getElementById("app"), { issue, comments: [] });
  });
  try {
    await click(button("Comentários"));
    await click(button("Incluir comentário"));
    const dialog = document.querySelector(".issueCommentDialog");
    assert.ok(dialog.querySelector('input[type="date"]').value);
    await changeField(dialog.querySelector('input[type="date"]'), "");
    await click(dialog.querySelector('[aria-label="Editar texto"]'));
    await changeField(dialog.querySelector("textarea"), "Comment without a known date");
    assert.equal(button("Salvar comentário", dialog).disabled, false);
    await click(button("Salvar comentário", dialog));
    assert.deepEqual(body, { text: "Comment without a known date", date: null });
  } finally {
    await harnessModule.act(async () => harness.root.unmount());
    harness.resetSession();
  }
});

function button(text, scope = document) {
  const match = [...scope.querySelectorAll("button")].find((item) => item.textContent.trim() === text);
  assert.ok(match, `Button not found: ${text}`);
  return match;
}

async function click(element) {
  await harnessModule.act(async () => element.click());
}

async function selectImage(scope = document) {
  const select = scope.querySelector('[aria-label="Inserir imagem de anexo"]');
  assert.ok(select);
  await harnessModule.act(async () => {
    select.value = file.id;
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}

test("preview resolves images in Markdown blocks and releases object URLs", async () => {
  let harness;
  const loaded = [];
  const beforeUrls = createdUrls.length;
  await harnessModule.act(async () => {
    harness = harnessModule.mountMarkdownPreview(
      document.getElementById("app"),
      "# [anexo: captura.png]\n\n- [cid:image@example.test]\n\n> ![Legenda](attachment:uploaded-image)\n\n| Imagem | Contexto |\n| --- | --- |\n| [anexo: captura.png] | Teste |\n\n`[anexo: captura.png]`\n\n![Externa](https://example.test/tracker.png) [anexo: ausente.png]",
      {
        attachments: [file],
        onLoadAttachment: async (attachment) => {
          loaded.push(attachment);
          return new Blob(["synthetic-image"], { type: "image/png" });
        },
      },
    );
  });
  try {
    assert.equal(document.querySelectorAll("img").length, 4);
    assert.equal(document.querySelector("blockquote img").alt, "Legenda");
    assert.equal(document.querySelector("code").textContent, "[anexo: captura.png]");
    assert.match(document.body.textContent, /https:\/\/example.test\/tracker.png/u);
    assert.match(document.body.textContent, /\[anexo: ausente.png\]/u);
    assert.deepEqual(loaded, [file, file, file, file]);
  } finally {
    await harnessModule.act(async () => harness.root.unmount());
  }
  for (const url of createdUrls.slice(beforeUrls)) assert.ok(revokedUrls.includes(url));
});

test("missing content shows a fallback and a late response after unmount creates no URL", async () => {
  let harness;
  await harnessModule.act(async () => {
    harness = harnessModule.mountMarkdownPreview(document.getElementById("app"), "[anexo: captura.png]", {
      attachments: [file],
      onLoadAttachment: async () => {
        throw new Error("HTTP 403");
      },
    });
  });
  assert.match(document.querySelector('[role="status"]').textContent, /Imagem indisponível: captura.png/u);
  await harnessModule.act(async () => harness.root.unmount());

  let resolve;
  const request = new Promise((done) => {
    resolve = done;
  });
  const beforeUrls = createdUrls.length;
  await harnessModule.act(async () => {
    harness = harnessModule.mountMarkdownPreview(document.getElementById("app"), "[anexo: captura.png]", {
      attachments: [file],
      onLoadAttachment: () => request,
    });
  });
  assert.match(document.body.textContent, /Carregando imagem/u);
  await harnessModule.act(async () => harness.root.unmount());
  await harnessModule.act(async () => resolve(new Blob(["synthetic-image"])));
  assert.equal(createdUrls.length, beforeUrls);
});

test("issue summary precedes description and saves independently from KB drafts", async () => {
  const updates = [];
  const requests = [];
  const originalSummary = "Resumo inicial";
  let issue = {
    id: "SYNTHETIC-001",
    title: "Issue de teste",
    type: "incident",
    status: "open",
    text: "[anexo: captura.png]",
    attachments: [file],
    classification: { summary: originalSummary, primaryTaxonomyId: "support", secondaryTaxonomyIds: [], tags: {} },
  };
  globalThis.fetch = async (url, options = {}) => {
    requests.push({ path: url.pathname, options });
    if (url.pathname.endsWith("/taxonomy"))
      return Response.json({
        taxonomy: {
          taxonomy: [{ id: "support", label: "Suporte" }],
          tagGroups: [{ id: "priority", label: "Prioridade", tags: ["alta"] }],
        },
      });
    if (url.pathname.endsWith("/classification")) {
      issue = { ...issue, classification: JSON.parse(options.body) };
      return Response.json({ issue });
    }
    if (url.pathname.includes("/attachments/"))
      return new Response("synthetic-image", { headers: { "Content-Type": "image/png" } });
    throw new Error(`Unexpected request: ${url.pathname}`);
  };
  let harness;
  await harnessModule.act(async () => {
    harness = harnessModule.mountIssueDetails(
      document.getElementById("app"),
      {
        issue,
        comments: [
          { _id: "comment-one", from: "Pessoa sintética", date: "2026-10-01", text: "[cid:image@example.test]" },
        ],
      },
      (updated) => updates.push(updated),
    );
  });
  try {
    assert.deepEqual(
      [...document.querySelectorAll(".detailSection h3")].map((heading) => heading.textContent),
      ["Resumo", "Descrição completa"],
    );
    assert.equal(document.querySelectorAll(".detailSection img").length, 1);
    const imageRequest = requests.find((request) => request.path.endsWith("/attachments/uploaded-image"));
    assert.equal(imageRequest.options.credentials, "include");
    assert.equal(imageRequest.options.headers["X-Biaws-Workspace-Id"], "synthetic-workspace");

    await click(button("KB"));
    assert.equal(document.querySelector(".kbSummaryPanel"), null);
    assert.equal(document.querySelector(".markdownEditor"), null);
    await click(button("Limpar Tudo"));
    await click(button("Descrição"));
    await selectImage(document.querySelector(".issueSummarySection"));
    const newSummary = `${originalSummary}![captura.png](attachment:uploaded-image)`;
    assert.equal(document.querySelector(".issueSummarySection textarea").value, newSummary);
    assert.equal(document.querySelector(".issueSummarySection textarea").getAttribute("aria-label"), "Resumo");
    await click(button("Salvar resumo"));
    assert.match(document.querySelector(".issueSummarySection").textContent, /Resumo salvo\./u);
    assert.equal(issue.classification.summary, newSummary);
    assert.equal(issue.classification.primaryTaxonomyId, "support", "summary save preserves persisted taxonomy");

    await click(button("KB"));
    assert.equal(
      button("Gravar KB").disabled,
      false,
      "pending taxonomy draft survives summary save and parent refresh",
    );
    await click(button("Gravar KB"));
    assert.equal(issue.classification.primaryTaxonomyId, "");
    assert.equal(issue.classification.summary, newSummary);

    await click(button("Descrição"));
    await selectImage(document.querySelector(".issueSummarySection"));
    const pendingSummary = document.querySelector(".issueSummarySection textarea").value;
    await click(button("KB"));
    await click(button("Prioridade"));
    await click(document.querySelector(".tagPickerDialog input"));
    await click(document.querySelector(".tagPickerDialog .iconButton"));
    await click(button("Gravar KB"));
    assert.equal(issue.classification.summary, newSummary, "KB save does not commit the pending summary");
    assert.deepEqual(issue.classification.tags, { priority: ["alta"] });
    await click(button("Descrição"));
    await click(document.querySelector('.issueSummarySection [aria-label="Editar texto"]'));
    assert.equal(document.querySelector(".issueSummarySection textarea").value, pendingSummary);
    assert.equal(button("Salvar resumo").disabled, false);
    assert.equal(updates.length, 3);

    await click(button("Comentários"));
    assert.equal(document.querySelector(".commentItem img").alt, file.filename);
    await click(button("Incluir comentário"));
    await selectImage(document.querySelector(".issueCommentDialog"));
    assert.equal(document.querySelector(".issueCommentDialog textarea").getAttribute("aria-label"), "Comentário");
    assert.equal(
      document.querySelector(".issueCommentDialog textarea").value,
      "![captura.png](attachment:uploaded-image)",
    );
    await click(document.querySelector('.issueCommentDialog [aria-label="Editar em tela cheia"]'));
    await click(document.querySelector('.markdownFullscreenDialog [aria-label="Visualizar conteúdo"]'));
    assert.equal(document.querySelector(".markdownFullscreenDialog img").alt, file.filename);
  } finally {
    await harnessModule.act(async () => harness.root.unmount());
    harness.resetSession();
  }
});
