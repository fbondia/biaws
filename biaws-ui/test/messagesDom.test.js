import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { JSDOM, VirtualConsole } from "jsdom";

const STYLE_FILES = {
  base: new URL("../src/styles/foundations/base.css", import.meta.url),
  catalog: new URL(
    "../src/styles/features/catalog/topology.css",
    import.meta.url,
  ),
  controls: new URL("../src/styles/shared/controls.css", import.meta.url),
  files: new URL("../src/styles/shared/files-panel.css", import.meta.url),
  home: new URL("../src/styles/features/home/dialogs.css", import.meta.url),
  knowledge: new URL(
    "../src/styles/features/knowledge/details.css",
    import.meta.url,
  ),
  messages: new URL("../src/styles/shared/messages.css", import.meta.url),
  replication: new URL(
    "../src/styles/shared/replication-dialog.css",
    import.meta.url,
  ),
  tokens: new URL("../src/styles/foundations/tokens.css", import.meta.url),
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function extractRule(source, selector) {
  const match = source.match(
    new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`, "u"),
  );
  assert.ok(match, `Regra CSS ausente: ${selector}`);
  return `${selector} {${match[1]}}`;
}

function resolveZIndex(window, element) {
  let value = window.getComputedStyle(element).zIndex.trim();
  const variable = value.match(/^var\((--[^),]+)(?:,[^)]+)?\)$/u)?.[1];
  if (variable) {
    value = window
      .getComputedStyle(window.document.documentElement)
      .getPropertyValue(variable)
      .trim();
  }
  const numeric = Number(value);
  assert.ok(Number.isFinite(numeric), `z-index não numérico: ${value}`);
  return numeric;
}

test("nested confirmation stays above consumer dialogs and below loading/notices", async () => {
  const sources = Object.fromEntries(
    await Promise.all(
      Object.entries(STYLE_FILES).map(async ([name, url]) => [
        name,
        await readFile(url, "utf8"),
      ]),
    ),
  );
  const css = [
    extractRule(sources.tokens, ":root"),
    extractRule(sources.controls, ".dialogBackdrop"),
    extractRule(sources.knowledge, ".knowledgeDetailsBackdrop"),
    extractRule(sources.catalog, ".topologyDiagramBackdrop"),
    extractRule(sources.home, ".homeMonitoringBackdrop"),
    extractRule(sources.files, ".filePreviewBackdrop"),
    extractRule(sources.messages, ".messagesDialogBackdrop"),
    extractRule(sources.base, ".globalLoading"),
    extractRule(sources.messages, ".messagesNotices"),
  ].join("\n");
  const dom = new JSDOM(
    `<!doctype html><html><head><style>${css}</style></head><body>
      <div class="dialogBackdrop knowledgeDetailsBackdrop" aria-modal="true" role="dialog"></div>
      <div class="dialogBackdrop topologyDiagramBackdrop" aria-modal="true" role="dialog"></div>
      <div class="dialogBackdrop homeMonitoringBackdrop" aria-modal="true" role="dialog"></div>
      <div class="dialogBackdrop filePreviewBackdrop" aria-modal="true" role="dialog"></div>
      <div class="dialogBackdrop messagesDialogBackdrop" aria-modal="true" role="dialog"></div>
      <div class="globalLoading"></div>
      <div class="messagesNotices"></div>
    </body></html>`,
    { virtualConsole: new VirtualConsole() },
  );
  const { document } = dom.window;
  const consumerDialogs = [
    ".knowledgeDetailsBackdrop",
    ".topologyDiagramBackdrop",
    ".homeMonitoringBackdrop",
    ".filePreviewBackdrop",
  ].map((selector) => document.querySelector(selector));
  const messageDialog = document.querySelector(".messagesDialogBackdrop");
  const loading = document.querySelector(".globalLoading");
  const notices = document.querySelector(".messagesNotices");
  const consumerMaximum = Math.max(
    ...consumerDialogs.map((dialog) => resolveZIndex(dom.window, dialog)),
  );
  const messageZIndex = resolveZIndex(dom.window, messageDialog);

  assert.equal(
    [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].at(-1),
    messageDialog,
  );
  assert.ok(messageZIndex > consumerMaximum);
  assert.ok(resolveZIndex(dom.window, loading) > messageZIndex);
  assert.ok(
    resolveZIndex(dom.window, notices) > resolveZIndex(dom.window, loading),
  );

  dom.window.close();
});

test("replication dialog stays above document details and below previews", async () => {
  const sources = Object.fromEntries(
    await Promise.all(
      Object.entries(STYLE_FILES).map(async ([name, url]) => [
        name,
        await readFile(url, "utf8"),
      ]),
    ),
  );
  const css = [
    extractRule(sources.tokens, ":root"),
    extractRule(sources.controls, ".dialogBackdrop"),
    extractRule(sources.knowledge, ".knowledgeDetailsBackdrop"),
    extractRule(sources.replication, ".replicationDialogBackdrop"),
    extractRule(sources.files, ".filePreviewBackdrop"),
  ].join("\n");
  const dom = new JSDOM(
    `<!doctype html><html><head><style>${css}</style></head><body>
      <div class="dialogBackdrop knowledgeDetailsBackdrop"></div>
      <div class="dialogBackdrop replicationDialogBackdrop"></div>
      <div class="dialogBackdrop filePreviewBackdrop"></div>
    </body></html>`,
    { virtualConsole: new VirtualConsole() },
  );
  const { document } = dom.window;
  const detailsZIndex = resolveZIndex(
    dom.window,
    document.querySelector(".knowledgeDetailsBackdrop"),
  );
  const replicationZIndex = resolveZIndex(
    dom.window,
    document.querySelector(".replicationDialogBackdrop"),
  );
  const previewZIndex = resolveZIndex(
    dom.window,
    document.querySelector(".filePreviewBackdrop"),
  );

  assert.ok(replicationZIndex > detailsZIndex);
  assert.ok(replicationZIndex < previewZIndex);

  dom.window.close();
});
