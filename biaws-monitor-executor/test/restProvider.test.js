import assert from "node:assert/strict";
import test from "node:test";

import { createRestProvider } from "../src/restProvider.js";

const localLookup = async () => [{ address: "127.0.0.1", family: 4 }];

test("REST provider validates, resolves references and truncates evidence", async () => {
  let authorization;
  const provider = createRestProvider({
    allowedHosts: ["rest.test"],
    allowPrivateAddresses: true,
    maxEvidenceBytes: 20,
    lookup: localLookup,
    resolveReference: async (reference) =>
      reference === "health-token" ? "Bearer private-value" : "",
    request: async (_url, _configuration, headers) => {
      authorization = headers.Authorization;
      return {
        response: { statusCode: 200, headers: {} },
        evidence: {
          body: "result Bearer private-value",
          bytes: 27,
          truncated: true,
        },
      };
    },
  });

  const configuration = provider.validateConfiguration({
    url: "http://rest.test/health",
    headerRefs: [{ name: "Authorization", reference: "health-token" }],
  });
  const result = await provider.execute({ configuration }, {});

  assert.equal(authorization, "Bearer private-value");
  assert.equal(result.status, "healthy");
  assert.equal(result.payload.response_body, "result [REDACTED]");
  assert.equal(result.metadata.evidence_truncated, true);
  assert.doesNotMatch(JSON.stringify(result), /private-value/u);
});

test("REST provider refuses private addresses and inline sensitive headers", async () => {
  const privateProvider = createRestProvider({
    allowedHosts: ["internal.test"],
    lookup: localLookup,
  });
  const configuration = privateProvider.validateConfiguration({
    url: "http://internal.test/health",
  });
  await assert.rejects(privateProvider.execute({ configuration }, {}), {
    code: "REST_ADDRESS_REFUSED",
  });
  assert.throws(
    () =>
      privateProvider.validateConfiguration({
        url: "https://example.com",
        headers: { Authorization: "Bearer value" },
      }),
    { code: "INLINE_SECRET_HEADER_REFUSED" },
  );
  assert.throws(
    () =>
      privateProvider.validateConfiguration({
        method: "DELETE",
        url: "https://internal.test/resource",
      }),
    { code: "HTTP_METHOD_REFUSED_BY_LOCAL_POLICY" },
  );
});

test("REST provider refuses cross-origin redirects to avoid forwarding references", async () => {
  const provider = createRestProvider({
    allowedHosts: ["rest.test", "other.test"],
    allowPrivateAddresses: true,
    lookup: localLookup,
    request: async () => ({
      response: {
        statusCode: 302,
        headers: { location: "http://other.test/health" },
      },
      evidence: { body: "", bytes: 0, truncated: false },
    }),
  });
  const configuration = provider.validateConfiguration({
    url: "http://rest.test/health",
    followRedirects: true,
  });
  await assert.rejects(provider.execute({ configuration }, {}), {
    code: "REST_REDIRECT_REFUSED",
  });
});

test("REST redirects outside the allowed origin are refused", async () => {
  const provider = createRestProvider({
    allowedHosts: ["rest.test"],
    allowPrivateAddresses: true,
    lookup: localLookup,
    request: async () => ({
      response: {
        statusCode: 302,
        headers: { location: "http://metadata.invalid/latest" },
      },
      evidence: { body: "", bytes: 0, truncated: false },
    }),
  });
  const configuration = provider.validateConfiguration({
    url: "http://rest.test/health",
    followRedirects: true,
  });
  await assert.rejects(provider.execute({ configuration }, {}), {
    code: "REST_REDIRECT_REFUSED",
  });
});

test("REST templates accept only complete JSON responses and publish parsed evidence", async () => {
  const response = (headers, body, bytes = Buffer.byteLength(body)) =>
    createRestProvider({
      allowedHosts: ["rest.test"],
      allowPrivateAddresses: true,
      lookup: localLookup,
      request: async () => ({
        response: { statusCode: 200, headers },
        evidence: { body, bytes, truncated: false },
      }),
    });
  const configuration = response({}, "{}").validateConfiguration({
    url: "http://rest.test/health",
  });
  const monitor = {
    configuration,
    templateRef: { id: "health", version: "1" },
  };
  const valid = response(
    { "content-type": "application/health+json; charset=utf-8" },
    '{"service":{"up":true}}',
  );
  assert.deepEqual((await valid.execute(monitor, {})).payload, {
    service: { up: true },
  });
  await assert.rejects(
    response({ "content-type": "text/plain" }, "{}").execute(monitor, {}),
    {
      code: "TEMPLATE_EVALUATION_FAILED",
    },
  );
  await assert.rejects(
    response({ "content-type": "application/json" }, "not-json").execute(
      monitor,
      {},
    ),
    {
      code: "TEMPLATE_EVALUATION_FAILED",
    },
  );
  await assert.rejects(
    response({ "content-type": "application/json" }, "{}", 8_001).execute(
      monitor,
      {},
    ),
    {
      code: "TEMPLATE_EVALUATION_FAILED",
    },
  );
  const explicitlyTruncated = createRestProvider({
    allowedHosts: ["rest.test"],
    allowPrivateAddresses: true,
    lookup: localLookup,
    request: async () => ({
      response: {
        statusCode: 200,
        headers: { "content-type": "application/json" },
      },
      evidence: { body: "{}", bytes: 2, truncated: true },
    }),
  });
  await assert.rejects(explicitlyTruncated.execute(monitor, {}), {
    code: "TEMPLATE_EVALUATION_FAILED",
  });
});
