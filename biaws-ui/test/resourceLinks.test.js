import assert from "node:assert/strict";
import test from "node:test";
import { resourceLinkHref } from "../src/navigation/resourceLinks.js";
import { entityUrl, readRoute } from "../src/navigation/model.js";
import {
  markdownToHtml,
  parseInlineMarkdown,
  safeMarkdownHref,
} from "../src/components/shared/MarkdownEditor/model.js";

const destinations = [
  ["", "/"],
  ["documents/doc", "/documents/doc"],
  ["documents/doc/content", "/documents/doc"],
  ["issues/INC42", "/issues/INC42"],
  ["demands/MEL42", "/requests/MEL42"],
  ["demands/MEL42/tasks/T1", "/requests/MEL42/tasks/T1"],
  ["applications/app", "/catalog/app"],
  ["servers/server", "/servers/server"],
  ["secrets/secret", "/secrets/secret"],
  ["skills/skill", "/skills/skill"],
  ["users/user", "/users/user"],
  ["groups/group", "/groups/group"],
  ["option-lists/status", "/option-lists/status"],
  ["taxonomy/nodes/domain%2Fsubject", "/taxonomy/nodes/domain%2Fsubject"],
  ["taxonomy/tag-groups/tags", "/taxonomy/tag-groups/tags"],
  ["classification-catalog", "/taxonomy"],
  ["monitoring/templates/template", "/operation/monitoring/templates/template"],
  ["applications/app/deployments/deploy/publications", "/operation/environment/publications/deploy"],
  ["applications/app/deployments/deploy/runtimes/runtime", "/catalog/app/runtimes/runtime"],
  ...["components", "repositories", "integrations", "deployments", "runtimes", "topology-diagrams"].map(
    (collection) => [`applications/app/${collection}/item`, `/catalog/app/${collection}/item`],
  ),
  ...["components", "repositories", "integrations", "deployments", "runtimes"].map((collection) => [
    `${collection}/item`,
    `/${collection}/item`,
  ]),
  ...[
    "documents",
    "issues",
    "demands",
    "applications",
    "servers",
    "secrets",
    "skills",
    "users",
    "groups",
    "option-lists",
  ].map((collection) => [
    collection,
    { demands: "/requests", applications: "/catalog" }[collection] || `/${collection}`,
  ]),
];

test("MCP entity links reach corresponding UI routes with their explicit workspace", () => {
  for (const [resource, path] of destinations) {
    const uri = `biaws://workspaces/workspace-b${resource ? `/${resource}` : ""}`;
    const href = resourceLinkHref(uri);
    assert.equal(href, `${path}?workspaceId=workspace-b`, resource);
    const route = readRoute(new URL(href, "https://biaws.example.test"));
    assert.equal(route.valid, true, resource);
    assert.equal(route.workspaceId, "workspace-b");
    assert.equal(safeMarkdownHref(uri), href);
  }
});

test("resource segments are decoded once and escaped as route segments", () => {
  const href = resourceLinkHref("biaws://workspaces/workspace%20b/documents/guia%20%2F%3F%23%25");
  const route = readRoute(new URL(href, "https://biaws.example.test"));
  assert.equal(route.workspaceId, "workspace b");
  assert.equal(route.selections.document, "guia /?#%");
  assert.match(href, /^\/documents\/guia%20%2F%3F%23%25\?workspaceId=workspace\+b$/u);
  assert.equal(resourceLinkHref("biaws://workspaces/w/documents/%252F"), "/documents/%252F?workspaceId=w");
});

test("unknown, malformed and non-screen MCP resources remain non-navigable", () => {
  for (const uri of [
    "biaws://workspaces",
    "biaws://other/w/documents/id",
    "biaws://user@workspaces/w/documents/id",
    "biaws://workspaces:42/w/documents/id",
    "biaws:///workspaces/w/documents/id",
    "biaws://workspaces//documents/id",
    "biaws://workspaces/w/documents/id/",
    "biaws://workspaces/w/documents/id?workspaceId=other",
    "biaws://workspaces/w/documents/id#fragment",
    "biaws://workspaces/w/documents/%ZZ",
    "biaws://workspaces/w/documents/%00",
    "biaws://workspaces/w/documents/..",
    "biaws://workspaces/w/documents/%2e%2e/issues/id",
    "biaws://workspaces/w/unknown/id",
    "biaws://workspaces/w/__proto__/id",
    "biaws://workspaces/w/documents/id/revisions/1",
    "biaws://workspaces/w/audit/documents/id",
    "biaws://workspaces/w/documents/id/files/file/content",
    "biaws://workspaces/w/monitoring/templates/id/versions/1.0.0",
    `biaws://workspaces/w/issues/${"a".repeat(241)}`,
  ]) {
    assert.equal(resourceLinkHref(uri), null, uri);
    assert.equal(safeMarkdownHref(uri), "", uri);
    assert.equal(markdownToHtml(`[Referência](${uri})`), "<p>Referência</p>", uri);
  }
});

test("Markdown labels, bare URIs and autolinks render the same destination without changing code", () => {
  const uri = "biaws://workspaces/w/documents/doc";
  assert.equal(markdownToHtml(`[Guia](${uri})`), '<p><a href="/documents/doc?workspaceId=w">Guia</a></p>');
  for (const markdown of [uri, `<${uri}>`])
    assert.equal(markdownToHtml(markdown), `<p><a href="/documents/doc?workspaceId=w">${uri}</a></p>`);
  assert.equal(markdownToHtml(`Veja ${uri}.`), `<p>Veja <a href="/documents/doc?workspaceId=w">${uri}</a>.</p>`);
  assert.deepEqual(parseInlineMarkdown(`\`${uri}\``), [{ type: "code", text: uri }]);
  assert.equal(markdownToHtml(`\`\`\`text\n${uri}\n\`\`\``), `<pre><code>${uri}</code></pre>`);
  assert.equal(safeMarkdownHref("https://example.test"), "https://example.test");
  assert.equal(safeMarkdownHref("mailto:test@example.test"), "mailto:test@example.test");
  assert.equal(safeMarkdownHref("javascript:alert(1)"), "#");
});

test("short catalog destinations can close and canonicalize after their authorized parent is resolved", () => {
  for (const [collection, type] of Object.entries({
    components: "component",
    integrations: "integration",
    repositories: "repository",
    deployments: "deployment",
    runtimes: "runtime",
  })) {
    const route = readRoute(new URL(`/${collection}/item?workspaceId=w`, "https://biaws.example.test"));
    assert.deepEqual(route.selections, { [type]: "item" });
    assert.equal(
      entityUrl(type, { id: "item", applicationId: "app" }, route),
      `/catalog/app/${collection}/item?workspaceId=w`,
    );
    assert.equal(entityUrl(type, null, route), "/catalog?workspaceId=w");
    assert.equal(readRoute({ pathname: `/${collection}/item/extra` }).valid, false);
  }
});
