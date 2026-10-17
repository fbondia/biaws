import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

// A disposable dependency prefix keeps this experiment out of the runtime.
const prefix = process.argv[2];
if (!prefix || !process.env.BIAWS_CHATGPT_TEST_MONGO_URI) {
  throw new Error(
    "Pass a dependency prefix and BIAWS_CHATGPT_TEST_MONGO_URI for a disposable database.",
  );
}
const resolve = createRequire(path.resolve(prefix, "package.json"));
const resolveMcp = createRequire(
  new URL("../../biaws-mcp/package.json", import.meta.url),
);
const dependency = (name) =>
  import(
    pathToFileURL(
      (name === "@modelcontextprotocol/server" ? resolveMcp : resolve).resolve(
        name,
      ),
    ).href
  );
const [
  { betterAuth },
  { jwt },
  { mcp },
  { cimd },
  { fetchClientMetadataResource },
  { mongodbAdapter },
  { MongoClient },
] = await Promise.all([
  dependency("better-auth"),
  dependency("better-auth/plugins"),
  dependency("@better-auth/mcp"),
  dependency("@better-auth/cimd"),
  dependency("@better-auth/cimd/node"),
  dependency("@better-auth/mongo-adapter"),
  dependency("mongodb"),
]);
const client = new MongoClient(process.env.BIAWS_CHATGPT_TEST_MONGO_URI);
const database = client.db(
  `biaws_chatgpt_probe_${randomBytes(8).toString("hex")}`,
);
const base = "http://localhost:54800";
const trace = (stage) => process.stderr.write(`probe: ${stage}\n`);
try {
  trace("connect");
  await client.connect();
  // Create collections before transactional registration, including resource links.
  for (const name of [
    "user",
    "session",
    "account",
    "verification",
    "jwks",
    "oauthClient",
    "oauthClientResource",
    "oauthResource",
    "oauthConsent",
    "oauthAccessToken",
    "oauthRefreshToken",
    "oauthClientAssertion",
  ]) {
    await database.createCollection(name);
  }
  const auth = betterAuth({
    baseURL: base,
    secret: randomBytes(32).toString("hex"),
    database: mongodbAdapter(database, { client }),
    emailAndPassword: { enabled: true },
    plugins: [
      jwt(),
      mcp({
        loginPage: "/login",
        consentPage: "/consent",
        resource: `${base}/mcp`,
        scopes: ["mcp:read", "offline_access"],
      }),
      cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
    ],
  });
  const context = await auth.$context;
  for (const metadataPath of [
    "/api/auth/.well-known/oauth-authorization-server",
    "/.well-known/oauth-protected-resource",
  ]) {
    const response = await auth.handler(new Request(`${base}${metadataPath}`));
    assert.equal(response.status, 200, `metadata endpoint ${metadataPath}`);
    assert.ok(
      (await response.json()).resource ||
        metadataPath.includes("authorization-server"),
    );
  }
  trace("indexes");
  // The Mongo adapter lazily creates indexes. Warm them before transactions:
  // creating an index after a write in the same transaction can deadlock.
  for (const model of [
    "oauthClient",
    "oauthClientResource",
    "oauthResource",
    "oauthConsent",
    "oauthAccessToken",
    "oauthRefreshToken",
    "oauthClientAssertion",
  ]) {
    await context.adapter.updateMany({
      model,
      where: [{ field: "id", value: "000000000000000000000000" }],
      update: { id: "000000000000000000000000" },
    });
  }
  trace("signup");
  const user = await auth.api.signUpEmail({
    body: {
      email: "probe@example.test",
      name: "Probe",
      password: "Synthetic-probe-password-42",
    },
  });
  trace("login");
  const login = await auth.api.signInEmail({
    body: { email: user.user.email, password: "Synthetic-probe-password-42" },
    asResponse: true,
  });
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  const headers = new Headers({ cookie, origin: base });
  trace("register");
  const oauthClient = await auth.api.createOAuthClient({
    headers,
    body: {
      client_name: "BIAWS disposable probe",
      redirect_uris: ["https://client.example.test/callback"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      scope: "mcp:read offline_access",
    },
  });
  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    client_id: oauthClient.client_id,
    redirect_uri: "https://client.example.test/callback",
    response_type: "code",
    scope: "mcp:read offline_access",
    state: "synthetic-state",
    resource: `${base}/mcp`,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  trace("authorize");
  const authorize = await auth.handler(
    new Request(`${base}/api/auth/oauth2/authorize?${query}`, { headers }),
  );
  assert.equal(authorize.status, 302);
  const consent = new URL(authorize.headers.get("location"), base);
  assert.equal(consent.pathname, "/consent");
  trace("consent");
  const accepted = await auth.handler(
    new Request(`${base}/api/auth/oauth2/consent?${consent.searchParams}`, {
      method: "POST",
      headers: { cookie, origin: base, "content-type": "application/json" },
      body: JSON.stringify({
        accept: true,
        oauth_query: consent.searchParams.toString(),
      }),
    }),
  );
  const acceptedBody = await accepted.json();
  assert.equal(accepted.status, 200, JSON.stringify(acceptedBody));
  const redirect = new URL(acceptedBody.redirect_uri ?? acceptedBody.url);
  assert.equal(redirect.searchParams.get("state"), "synthetic-state");
  const exchange = new URLSearchParams({
    grant_type: "authorization_code",
    code: redirect.searchParams.get("code"),
    client_id: oauthClient.client_id,
    redirect_uri: "https://client.example.test/callback",
    code_verifier: verifier,
    resource: `${base}/mcp`,
  });
  trace("exchange");
  const token = await auth.handler(
    new Request(`${base}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: exchange,
    }),
  );
  const tokens = await token.json();
  assert.equal(
    token.status,
    200,
    JSON.stringify({
      error: tokens.error,
      description: tokens.error_description,
    }),
  );
  assert.ok(tokens.refresh_token);
  const claims = JSON.parse(
    Buffer.from(tokens.access_token.split(".")[1], "base64url"),
  );
  assert.equal(claims.sub, user.user.id);
  assert.ok([claims.aud].flat().includes(`${base}/mcp`));
  const replay = await auth.handler(
    new Request(`${base}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: exchange,
    }),
  );
  assert.notEqual(replay.status, 200);
  const { createMcpHandler, McpServer } = await dependency(
    "@modelcontextprotocol/server",
  );
  const handler = createMcpHandler(
    () => new McpServer({ name: "probe", version: "0.0.0" }),
    { legacy: "stateless" },
  );
  const discovery = await handler.fetch(
    new Request(`${base}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "probe", version: "0.0.0" },
        },
      }),
    }),
  );
  assert.equal(discovery.status, 200);
  console.log(
    JSON.stringify({
      oauth: "passed",
      consent: "passed",
      audience: "passed",
      replayRejected: true,
      mcpHttp: "passed",
      client: "synthetic SDK request; ChatGPT validation pending",
    }),
  );
} finally {
  await database.dropDatabase();
  await client.close();
}
