import assert from "node:assert/strict";
import test from "node:test";
import type { Server } from "node:http";
import { createApp } from "../../src/app.js";
import { availablePort, restoreEnvironmentAfter } from "../support/integration.js";

const enabled = Boolean(process.env.BIAWS_HTTP_INTEGRATION);

async function closeServer(server: Server) {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

test(
  "Swagger UI serves local assets and the generated document without embedding credentials",
  { skip: !enabled },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.BIAWS_API_DOCS_ENABLED = "true";
    const port = await availablePort();
    const server = createApp().listen(port, "127.0.0.1");
    try {
      const base = `http://127.0.0.1:${port}`;
      const page = await fetch(`${base}/api/docs/`);
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.match(html, /swagger-ui/);
      assert.match(html, /swagger-ui-bundle\.js/);
      assert.equal(html.includes("biaws_"), false);

      const script = await fetch(`${base}/api/docs/swagger-ui-bundle.js`);
      assert.equal(script.status, 200);
      assert.match(script.headers.get("content-type") || "", /javascript/);
      await script.arrayBuffer();
      const css = await fetch(`${base}/api/docs/swagger-ui.css`);
      assert.equal(css.status, 200);
      assert.match(css.headers.get("content-type") || "", /css/);
      await css.arrayBuffer();

      const initializer = await fetch(`${base}/api/docs/swagger-ui-init.js`);
      assert.equal(initializer.status, 200);
      const js = await initializer.text();
      assert.match(js, /\.\.\/openapi\.json/);
      assert.match(js, /"validatorUrl": null/);
      assert.match(js, /"persistAuthorization": false/);

      const document = await fetch(`${base}/api/openapi.json`);
      assert.equal(document.status, 200);
      assert.equal(((await document.json()) as { openapi: string }).openapi, "3.1.0");
    } finally {
      await closeServer(server);
    }
  },
);

test("documentation routes are disabled together by configuration", { skip: !enabled }, async (t) => {
  restoreEnvironmentAfter(t);
  process.env.BIAWS_API_DOCS_ENABLED = "false";
  const port = await availablePort();
  const server = createApp().listen(port, "127.0.0.1");
  try {
    for (const path of ["/api/docs/", "/api/openapi.json"]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 404);
    }
  } finally {
    await closeServer(server);
  }
});
