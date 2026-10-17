import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdtemp, readFile, writeFile, chmod, rm } from "node:fs/promises";
import { createServer as httpsServer, request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { Readable } from "node:stream";
import { checkServerIdentity } from "node:tls";
import { once } from "node:events";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  Client,
  StreamableHTTPClientTransport,
} from "../../biaws-mcp/node_modules/@modelcontextprotocol/client/dist/index.mjs";

if (process.env.BIAWS_CHATGPT_DOCKER_TEST !== "1")
  throw new Error("Opt in with BIAWS_CHATGPT_DOCKER_TEST=1; this creates disposable Docker projects");
const root = fileURLToPath(new URL("../../", import.meta.url));
const mongoImage = process.env.BIAWS_CHATGPT_TEST_MONGO_IMAGE || "mongo:8.0";
if (!["mongo:7.0", "mongo:8.0"].includes(mongoImage)) throw new Error("Only supported test Mongo images are allowed");
const scratch = await mkdtemp(path.join(os.tmpdir(), "biaws-chatgpt-test-"));
const batch = randomUUID().slice(0, 8),
  images = "biaws-chatgpt-test-" + batch;
const fixtures = [],
  clients = [],
  credentials = [];
const scenarios = [];
function stage(name) {
  console.log("chatgpt integration: " + name);
}
function command(binary, args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data;
    });
    child.stderr.on("data", (data) => {
      stderr += data;
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(binary + " failed (" + code + "): " + stderr.slice(-1200))),
    );
    child.stdin.end(input);
  });
}
const docker = (args, options) => command("docker", args, options);
const json = (bytes) => JSON.parse(Buffer.from(bytes).toString());
async function fixture(index, { build = false } = {}) {
  const name = "biaws-chatgpt-test-" + batch + "-" + index,
    dir = path.join(scratch, String(index));
  await command("mkdir", ["-p", dir]);
  const key = path.join(scratch, "tls.key"),
    cert = await readFile(path.join(scratch, "tls.crt"));
  let uiPort;
  const proxy = httpsServer({ key: await readFile(key), cert }, (req, res) => {
    if (!uiPort) {
      res.writeHead(503).end();
      return;
    }
    const upstream = httpRequest(
      { hostname: "127.0.0.1", port: uiPort, path: req.url, method: req.method, headers: req.headers },
      (reply) => {
        res.writeHead(reply.statusCode, reply.headers);
        reply.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502).end();
    });
    req.on("aborted", () => upstream.destroy());
    req.pipe(upstream);
  });
  proxy.listen(0, "127.0.0.1");
  await once(proxy, "listening");
  const origin = "https://127.0.0.1:" + proxy.address().port,
    serviceSecret = randomBytes(32).toString("hex"),
    authSecret = randomBytes(32).toString("hex");
  credentials.push(serviceSecret, authSecret);
  const envFile = path.join(dir, ".env"),
    master = path.join(dir, "master"),
    secret = path.join(dir, "service");
  await writeFile(master, randomBytes(32), { mode: 0o600 });
  await writeFile(secret, serviceSecret, { mode: 0o600 });
  await writeFile(
    envFile,
    [
      "BETTER_AUTH_SECRET=" + authSecret,
      "BIAWS_SECRETS_KEY_PATH=" + master,
      "BIAWS_MCP_SERVICE_SECRET_PATH=" + secret,
      "BIAWS_MCP_HTTP_ENABLED=true",
      "BIAWS_MCP_CONFIGURED=true",
      "BIAWS_MCP_UID=" + (process.getuid?.() ?? 1000),
      "BIAWS_MCP_GID=" + (process.getgid?.() ?? 1000),
      "BIAWS_PUBLIC_URL=" + origin,
      "BIAWS_MCP_PUBLIC_URL=" + origin + "/mcp",
      "BIAWS_PUBLIC_SCHEME=https",
      "BIAWS_TRUSTED_ORIGINS=" + origin,
      "BETTER_AUTH_SECURE_COOKIES=true",
      "BIAWS_UI_PORT=0",
      "BIAWS_API_PORT=0",
      "MONGO_PORT=0",
      "MONGO_DB=biaws_chatgpt_test_" + batch + "_" + index,
      "BIAWS_API_RATE_LIMIT_MAX_REQUESTS=1000",
      "BETTER_AUTH_RATE_LIMIT_MAX_REQUESTS=1000",
    ].join("\n") + "\n",
    { mode: 0o600 },
  );
  const override = path.join(dir, "test.yaml");
  await writeFile(
    override,
    "services:\n  mongo:\n    image: " +
      mongoImage +
      "\n  mongo-init:\n    image: " +
      mongoImage +
      "\n  api:\n    image: " +
      images +
      "-api\n  mcp:\n    image: " +
      images +
      "-mcp\n  ui:\n    image: " +
      images +
      "-ui\n",
  );
  const base = [
    "compose",
    "--project-directory",
    root,
    "-f",
    path.join(root, "compose.yaml"),
    "-f",
    path.join(root, "compose.mcp.yaml"),
    "-f",
    override,
    "--env-file",
    envFile,
    "-p",
    name,
    "--profile",
    "mcp-http",
  ];
  const item = {
    name,
    dir,
    origin,
    serviceSecret,
    base,
    proxy,
    cert,
    async run(script) {
      return docker(["exec", "-i", name + "-api-1", "node", "--input-type=module"], { input: script });
    },
  };
  fixtures.push(item);
  if (build) {
    stage("build isolated images");
    await docker([...base, "build", "api", "mcp", "ui"]);
  }
  stage("start disposable instance " + index);
  await docker([...base, "up", "-d", "--no-build", "--wait", "--wait-timeout", "120"]);
  uiPort = Number((await docker([...base, "port", "ui", "80"])).trim().split(":").at(-1));
  item.fetch = async (input, init = {}) => {
    const request = new Request(input, init),
      body = await request.arrayBuffer(),
      url = new URL(request.url);
    assert.equal(url.origin, origin, "test fetch is confined to its fixture");
    return new Promise((resolve, reject) => {
      const outgoing = httpsRequest(
        url,
        {
          method: request.method,
          headers: Object.fromEntries(request.headers),
          ca: cert,
          signal: request.signal,
          checkServerIdentity: (_hostname, certificate) => checkServerIdentity(url.hostname, certificate),
        },
        (incoming) => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(incoming.headers))
            for (const item of Array.isArray(value) ? value : [value])
              if (item !== undefined) headers.append(name, item);
          resolve(
            new Response([204, 205, 304].includes(incoming.statusCode) ? null : Readable.toWeb(incoming), {
              status: incoming.statusCode,
              headers,
            }),
          );
        },
      );
      outgoing.once("error", reject);
      outgoing.end(Buffer.from(body));
    });
  };
  item.call = async (pathname, body, { cookie = "", token = "", method, headers = {} } = {}) =>
    item.fetch(origin + pathname, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        origin,
        ...(cookie ? { cookie } : {}),
        ...(token ? { authorization: "Bearer " + token } : {}),
        ...(body
          ? {
              "content-type":
                body instanceof URLSearchParams ? "application/x-www-form-urlencoded" : "application/json",
            }
          : {}),
        ...headers,
      },
      body: body ? (body instanceof URLSearchParams ? body : JSON.stringify(body)) : undefined,
      redirect: "manual",
    });
  const seeded = await item.run(await readFile(new URL("./seed-test-instance.mjs", import.meta.url), "utf8"));
  item.seed = JSON.parse(seeded.trim().split("\n").at(-1));
  credentials.push(...item.seed.users.map((u) => u.password));
  return item;
}
async function login(item, index = 0) {
  const user = item.seed.users[index],
    response = await item.call("/api/auth/sign-in/email", { email: user.email, password: user.password });
  assert.equal(response.status, 200, "existing account login");
  const cookie = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  credentials.push(cookie);
  return cookie;
}
async function authorize(item, cookie, workspaceId, scope = "mcp:read mcp:write offline_access", replayCode = false) {
  const registration = await item.call(
    "/api/auth/oauth2/create-client",
    {
      client_name: "Synthetic integration",
      redirect_uris: ["https://client.example.test/cb"],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      scope,
    },
    { cookie },
  );
  assert.equal(registration.status, 201, "register synthetic public client");
  const client = await registration.json(),
    verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: "https://client.example.test/cb",
    response_type: "code",
    scope,
    resource: item.origin + "/mcp",
    state: randomUUID(),
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  const started = await item.call("/api/auth/oauth2/authorize?" + query, undefined, { cookie });
  assert.equal(started.status, 302, "authorization selects consent UI");
  const choice = new URL(started.headers.get("location"), item.origin);
  const decision = await item.call(
    "/api/oauth/decision",
    { query: choice.searchParams.toString(), accept: true, workspaceId },
    { cookie },
  );
  assert.equal(decision.status, 200, "signed consent decision");
  const redirect = new URL((await decision.json()).redirectUrl);
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: client.client_id,
    redirect_uri: "https://client.example.test/cb",
    code: redirect.searchParams.get("code"),
    code_verifier: verifier,
    resource: item.origin + "/mcp",
  });
  const exchanged = await item.call("/api/auth/oauth2/token", form);
  assert.equal(exchanged.status, 200, "PKCE exchange");
  const tokens = await exchanged.json();
  assert.equal(typeof tokens.refresh_token, "string", "offline_access must issue a refresh token");
  credentials.push(tokens.access_token, tokens.refresh_token);
  if (replayCode) {
    const replay = await item.call("/api/auth/oauth2/token", form);
    assert.equal(replay.status, 400, "authorization code cannot be replayed");
  }
  return {
    ...tokens,
    clientId: client.client_id,
    claims: json(Buffer.from(tokens.access_token.split(".")[1], "base64url")),
  };
}
async function connect(item, token, mode = "legacy") {
  const client = new Client({ name: "biaws-security-test", version: "1" }, { versionNegotiation: { mode } });
  clients.push(client);
  await client.connect(
    new StreamableHTTPClientTransport(new URL(item.origin + "/mcp"), {
      fetch: item.fetch,
      requestInit: { headers: { authorization: "Bearer " + token } },
    }),
  );
  return client;
}
function payload(result) {
  assert.equal(
    result.isError,
    undefined,
    "permitted tool succeeds: " + JSON.stringify(result.structuredContent?.error || {}),
  );
  return result.structuredContent;
}
async function forbidden(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  assert.equal(result.isError, true, "forbidden tool is a domain error");
  assert.ok([403, 404].includes(result.structuredContent.error.status), "scope denied");
}
try {
  stage("create private test certificate");
  await command("openssl", [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=127.0.0.1",
    "-addext",
    "subjectAltName=IP:127.0.0.1",
    "-keyout",
    path.join(scratch, "tls.key"),
    "-out",
    path.join(scratch, "tls.crt"),
  ]);
  await chmod(path.join(scratch, "tls.key"), 0o600);
  const a = await fixture(1, { build: true }),
    b = await fixture(2);
  for (const item of [a, b]) {
    await docker([
      "exec",
      item.name + "-mcp-1",
      "node",
      "--input-type=module",
      "-e",
      'import {lookup} from "node:dns/promises";import {readdir,access} from "node:fs/promises";if(process.env.MONGO_URI || process.env.BIAWS_API_KEY)throw Error("unexpected domain credential");if((await readdir("/run/secrets")).join()!=="mcp-service-secret")throw Error("unexpected secret mount");try{await lookup("mongo");throw Error("Mongo DNS visible")}catch(e){if(e.message==="Mongo DNS visible")throw e;}try{await access("/data");throw Error("domain volume visible")}catch(e){if(e.message==="domain volume visible")throw e;}',
    ]);
  }
  stage("OAuth and PKCE through TLS and Nginx");
  const [cookieA, cookieA2, cookieB] = await Promise.all([login(a), login(a, 1), login(b)]);
  const [ta, tb, tc, td, tr] = await Promise.all([
    authorize(a, cookieA, a.seed.workspaces[0].id),
    authorize(a, cookieA, a.seed.workspaces[1].id),
    authorize(a, cookieA2, a.seed.workspaces[1].id),
    authorize(b, cookieB, b.seed.workspaces[0].id),
    authorize(a, cookieA, a.seed.workspaces[0].id, "mcp:read offline_access"),
  ]);
  assert.notEqual(ta.claims.biaws_grant_id, tb.claims.biaws_grant_id);
  await authorize(a, cookieA, a.seed.workspaces[0].id, "mcp:read offline_access", true);
  const [ca, cb, cc, cd, cr] = await Promise.all([
    connect(a, ta.access_token),
    connect(a, tb.access_token, "modern"),
    connect(a, tc.access_token),
    connect(b, td.access_token),
    connect(a, tr.access_token),
  ]);
  scenarios.push("existing login, signed consent, PKCE, code replay, two eras and two independent instances");
  stage("concurrent scoped reads and writes");
  const tuples = [
    [a, ca, 0, 0],
    [a, cb, 1, 0],
    [a, cc, 1, 1],
    [b, cd, 0, 0],
  ];
  const created = await Promise.all(
    tuples.map(async ([item, client, w, u]) => {
      const result = payload(
        await client.callTool({
          name: "issues_create",
          arguments: {
            title: "Synthetic isolation " + w + u,
            id: "synthetic-oauth-" + randomUUID(),
            text: "Disposable test evidence",
            applicationId: item.seed.workspaces[w].apps[u],
          },
        }),
      );
      assert.equal(result.issue.workspaceId, item.seed.workspaces[w].id);
      assert.equal(result.issue.applicationId, item.seed.workspaces[w].apps[u]);
      return result.issue;
    }),
  );
  await Promise.all(
    tuples.map(async ([item, client, w, u], i) => {
      const result = payload(
        await client.callTool({ name: "issues_search", arguments: { applicationId: item.seed.workspaces[w].apps[u] } }),
      );
      assert.ok(JSON.stringify(result).includes(created[i].id));
      for (let j = 0; j < created.length; j++)
        if (j !== i) assert.equal(JSON.stringify(result).includes(created[j].id), false);
    }),
  );
  await forbidden(ca, "issues_create", {
    title: "Forbidden",
    text: "Scope denied",
    applicationId: a.seed.workspaces[0].apps[1],
  });
  await forbidden(cr, "issues_create", {
    title: "Read only",
    text: "Denied",
    applicationId: a.seed.workspaces[0].apps[0],
  });
  assert.ok((await ca.listResources()).resources.length > 0);
  assert.ok((await ca.listResourceTemplates()).resourceTemplates.length > 0);
  const resource = await ca.readResource({
    uri: "biaws://workspaces/" + a.seed.workspaces[0].id + "/issues/" + created[0].id,
  });
  assert.ok(resource.contents.length > 0);
  await assert.rejects(
    ca.readResource({ uri: "biaws://workspaces/" + a.seed.workspaces[1].id + "/issues/" + created[1].id }),
  );
  const local = await ca.callTool({
    name: "issues_analyze_eml_file",
    arguments: { filePath: "/run/secrets/private.eml" },
  });
  assert.equal(local.structuredContent.error.code, "LOCAL_CLIENT_REQUIRED");
  const external = await a.call("/api/issues", undefined, { token: ta.access_token });
  assert.equal(external.status, 401, "external MCP token is not a domain credential");
  const delegation = await a.call(
    "/api/auth/mcp/delegate",
    { subject_token: ta.access_token },
    { headers: { "x-biaws-mcp-service-secret": a.serviceSecret } },
  );
  assert.equal(delegation.status, 200);
  const delegated = await delegation.json();
  credentials.push(delegated.accessToken);
  assert.equal((await a.call("/api/secrets/synthetic/reveal", {}, { token: delegated.accessToken })).status, 403);
  assert.equal((await a.call("/api/oauth/connections", undefined, { token: delegated.accessToken })).status, 403);
  assert.equal(
    (
      await a.call(
        "/api/oauth/decision",
        { query: "invalid", accept: false },
        { cookie: cookieA, headers: { origin: "https://evil.example.test" } },
      )
    ).status,
    403,
  );
  const crossInstance = await b.call(
    "/mcp",
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
    { token: ta.access_token, headers: { accept: "application/json, text/event-stream" } },
  );
  assert.equal(crossInstance.status, 401, "instance audience/issuer isolation");
  const requestBody = { jsonrpc: "2.0", id: 1, method: "tools/list" };
  assert.equal(
    (
      await a.call("/mcp", requestBody, {
        token: ta.access_token,
        headers: { host: "evil.example.test", accept: "application/json, text/event-stream" },
      })
    ).status,
    403,
    "proxy preserves Host validation",
  );
  assert.equal(
    (
      await a.call("/mcp", requestBody, {
        token: ta.access_token,
        headers: { origin: "https://evil.example.test", accept: "application/json, text/event-stream" },
      })
    ).status,
    403,
    "proxy preserves Origin validation",
  );
  for (const patch of [
    { aud: "https://wrong.example.test/mcp" },
    { iat: Math.floor(Date.now() / 1000) - 120, exp: Math.floor(Date.now() / 1000) - 60 },
  ]) {
    const signed = JSON.parse(
      (
        await a.run(
          'import {getAuth} from "./dist/biaws-api/src/auth/auth.js";import {closeMongoClient} from "./dist/biaws-api/src/helpers/mongoClient.js";const auth=await getAuth();console.log(JSON.stringify(await auth.api.signJWT({body:{payload:' +
            JSON.stringify({ ...ta.claims, ...patch }) +
            "}})));await closeMongoClient();",
        )
      )
        .trim()
        .split("\n")
        .at(-1),
    );
    credentials.push(signed.token);
    assert.equal(
      (
        await a.call(
          "/api/auth/mcp/delegate",
          { subject_token: signed.token },
          { headers: { "x-biaws-mcp-service-secret": a.serviceSecret } },
        )
      ).status,
      401,
      "signed invalid audience/expiration is rejected",
    );
  }
  scenarios.push(
    "concurrent users/workspaces/applications; read-only scope; API audience; secret/session restrictions; CSRF; local path denial",
  );
  stage("refresh, current permissions, membership, ban and revocation");
  const refreshed = await a.call(
    "/api/auth/oauth2/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tr.refresh_token,
      client_id: tr.clientId,
      resource: a.origin + "/mcp",
    }),
  );
  if (refreshed.status !== 200) {
    const failure = await refreshed.json();
    throw new Error(
      "Refresh rejected: " +
        JSON.stringify({
          error: failure.error,
          error_description: failure.error_description,
          code: failure.code,
          message: failure.message,
        }),
    );
  }
  const fresh = await refreshed.json();
  credentials.push(fresh.access_token, fresh.refresh_token);
  const refreshReplay = await a.call(
    "/api/auth/oauth2/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tr.refresh_token,
      client_id: tr.clientId,
      resource: a.origin + "/mcp",
    }),
  );
  assert.equal(refreshReplay.status, 400, "rotated refresh token cannot be replayed");
  await a.run(
    'import {setUserGroups} from "./dist/biaws-api/src/repositories/access/index.js";import {closeMongoClient} from "./dist/biaws-api/src/helpers/mongoClient.js";await setUserGroups(' +
      JSON.stringify(a.seed.users[0].userId) +
      ',[],{userId:"synthetic-operator",workspaceId:' +
      JSON.stringify(a.seed.workspaces[0].id) +
      "});await closeMongoClient();",
  );
  await forbidden(ca, "issues_search", { applicationId: a.seed.workspaces[0].apps[0] });
  await a.run(
    'import {getMongoDatabase,closeMongoClient} from "./dist/biaws-api/src/helpers/mongoClient.js";const db=await getMongoDatabase();await db.collection("workspaceMemberships").deleteOne({userId:' +
      JSON.stringify(a.seed.users[0].userId) +
      ",workspaceId:" +
      JSON.stringify(a.seed.workspaces[1].id) +
      "});await closeMongoClient();",
  );
  assert.equal(
    (
      await a.call(
        "/api/auth/mcp/delegate",
        { subject_token: tb.access_token },
        { headers: { "x-biaws-mcp-service-secret": a.serviceSecret } },
      )
    ).status,
    401,
    "removed workspace invalidates delegation",
  );
  const revoked = await a.call("/api/oauth/connections/" + tc.claims.biaws_grant_id, undefined, {
    cookie: cookieA2,
    method: "DELETE",
  });
  assert.equal(revoked.status, 200);
  assert.equal(
    (
      await a.call(
        "/api/auth/mcp/delegate",
        { subject_token: tc.access_token },
        { headers: { "x-biaws-mcp-service-secret": a.serviceSecret } },
      )
    ).status,
    401,
    "revocation immediate",
  );
  await b.run(
    'import {ObjectId} from "mongodb";import {getMongoDatabase,closeMongoClient} from "./dist/biaws-api/src/helpers/mongoClient.js";const db=await getMongoDatabase();await db.collection("authUsers").updateOne({_id:new ObjectId(' +
      JSON.stringify(b.seed.users[0].userId) +
      ")},{$set:{banned:true}});await closeMongoClient();",
  );
  assert.equal(
    (
      await b.call(
        "/api/auth/mcp/delegate",
        { subject_token: td.access_token },
        { headers: { "x-biaws-mcp-service-secret": b.serviceSecret } },
      )
    ).status,
    401,
    "banned account invalidates delegation",
  );
  scenarios.push("refresh rotation/replay; reduced permissions; removed membership; user ban; immediate revocation");
  stage("audit attribution and sanitized logs");
  const audit = JSON.parse(
    (
      await a.run(
        'import {getMongoDatabase,closeMongoClient} from "./dist/biaws-api/src/helpers/mongoClient.js";const db=await getMongoDatabase();const rows=await db.collection("auditEvents").find({"actor.authenticationMethod":"oauth-delegated"}).toArray();console.log(JSON.stringify(rows));await closeMongoClient();',
      )
    )
      .trim()
      .split("\n")
      .at(-1),
  );
  assert.ok(
    audit.some(
      (row) => row.actor.userId === a.seed.users[0].userId && row.actor.oauthGrantId === ta.claims.biaws_grant_id,
    ),
    "OAuth audit attribution",
  );
  for (const item of fixtures) {
    const logs = await docker([...item.base, "logs", "--no-color", "api", "mcp", "ui"]);
    for (const secret of credentials.filter(Boolean))
      assert.equal(logs.includes(secret), false, "credential must not appear in service logs");
  }
  scenarios.push("OAuth user/grant audit attribution and no generated credentials in container logs");
  stage("PASS " + scenarios.length + " scenario groups");
  console.log(
    JSON.stringify(
      {
        result: "passed",
        mongoImage,
        scenarios,
        limitation: "Local TLS with a private test CA; no public reachability or real ChatGPT claim.",
      },
      null,
      2,
    ),
  );
} finally {
  for (const client of clients) await client.close().catch(() => {});
  for (const item of fixtures.reverse()) {
    await docker([...item.base, "down", "--volumes", "--remove-orphans"]).catch(() => {});
    item.proxy.closeAllConnections();
    await new Promise((resolve) => item.proxy.close(resolve));
  }
  await rm(scratch, { recursive: true, force: true });
}
