import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { act } from "react";
import "react-dom/client";
import react from "@vitejs/plugin-react";
import { JSDOM } from "jsdom";
import { build } from "vite";

test("OAuth shows client/scopes and requires workspace; denial and revocation use account APIs", async () => {
  const out = await mkdtemp(join(tmpdir(), "biaws-oauth-ui-"));
  const dom = new JSDOM("<!doctype html><div id=app></div>", {
    url: "https://biaws.example.test/oauth/connect?state=signed",
  });
  const prior = Object.fromEntries(
    ["document", "navigator", "window", "fetch"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  const calls = [];
  let revoked = false;
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    window: { configurable: true, value: dom.window },
    fetch: {
      configurable: true,
      value: async (url, options) => {
        const path = new URL(url).pathname;
        const body = options.body ? JSON.parse(options.body) : null;
        calls.push({ path, body, method: options.method });
        if (path.endsWith("/context"))
          return Response.json({ clientName: "Cliente sintético", scopes: ["mcp:read", "offline_access"] });
        if (path.endsWith("/decision"))
          return Response.json({ error: { message: "Recusa recebida" } }, { status: 400 });
        if (options.method === "DELETE") {
          revoked = true;
          return Response.json({ revoked: true });
        }
        return Response.json({
          enabled: true,
          items: revoked ? [] : [{ id: "grant", clientId: "client", workspaceId: "two", scopes: ["mcp:read"] }],
        });
      },
    },
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let root;
  try {
    await build({
      configFile: false,
      logLevel: "silent",
      plugins: [react()],
      build: {
        rollupOptions: {
          external: ["react", "react-dom/client", "react/jsx-runtime"],
          output: {
            paths: {
              react: join(process.cwd(), "node_modules/react/index.js"),
              "react-dom/client": join(process.cwd(), "node_modules/react-dom/client.js"),
              "react/jsx-runtime": join(process.cwd(), "node_modules/react/jsx-runtime.js"),
            },
          },
        },
        lib: { entry: join(process.cwd(), "test/fixtures/OAuthHarness.jsx"), fileName: "oauth", formats: ["es"] },
        outDir: out,
      },
    });
    const harness = await import(pathToFileURL(join(out, "oauth.js")));
    await act(async () => {
      root = harness.mount(document.getElementById("app"));
    });
    assert.match(document.body.textContent, /Cliente sintético/);
    assert.match(document.body.textContent, /Manter a conexão/);
    assert.equal(document.querySelector(".primaryButton").disabled, true);
    const select = document.querySelector("select");
    await act(async () => {
      select.value = "two";
      select.dispatchEvent(new window.Event("change", { bubbles: true }));
    });
    assert.equal(document.querySelector(".primaryButton").disabled, false);
    await act(async () => {
      [...document.querySelectorAll("button")].find((b) => b.textContent === "Recusar").click();
    });
    assert.deepEqual(calls.find((c) => c.path.endsWith("/decision")).body, {
      query: "state=signed",
      accept: false,
      workspaceId: "two",
    });
    assert.match(document.body.textContent, /Recusa recebida/);
    await act(async () => {
      root.unmount();
      root = harness.mount(document.getElementById("app"), true);
    });
    assert.match(document.body.textContent, /Segundo/);
    await act(async () => {
      document.querySelector("button").click();
    });
    assert.ok(calls.some((c) => c.path.endsWith("/connections/grant") && c.method === "DELETE"));
    assert.match(document.body.textContent, /Nenhuma conexão/);
    await act(async () => root.unmount());
  } finally {
    for (const [name, descriptor] of Object.entries(prior)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
    await rm(out, { recursive: true, force: true });
  }
});
