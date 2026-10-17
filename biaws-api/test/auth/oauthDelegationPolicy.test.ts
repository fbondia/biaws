import assert from "node:assert/strict";
import test from "node:test";
import {
  hashDelegation,
  mcpSubjectClaims,
  requireMcpServiceSecret,
  classifyMcpDelegationFailure,
} from "../../src/auth/oauthDelegationPolicy.js";
test("invalid cryptographic tokens and removed grants return authentication errors, preserving infrastructure failures", () => {
  for (const code of [
    "ERR_JWT_CLAIM_VALIDATION_FAILED",
    "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
    "ERR_JWKS_NO_MATCHING_KEY",
  ]) {
    assert.deepEqual(classifyMcpDelegationFailure({ code }), { status: "UNAUTHORIZED", error: "invalid_token" });
  }
  assert.equal(classifyMcpDelegationFailure({ statusCode: 403, code: "WORKSPACE_FORBIDDEN" })?.status, "UNAUTHORIZED");
  assert.equal(classifyMcpDelegationFailure({ statusCode: 403, code: "INSUFFICIENT_MCP_SCOPE" })?.status, "FORBIDDEN");
  assert.equal(
    classifyMcpDelegationFailure({ statusCode: 503, code: "MCP_SERVICE_UNAVAILABLE" })?.status,
    "SERVICE_UNAVAILABLE",
  );
  assert.equal(classifyMcpDelegationFailure(new Error("database unavailable")), null);
});
test("MCP service authentication requires a configured strong secret", () => {
  assert.throws(() => requireMcpServiceSecret("x", {}), { code: "MCP_SERVICE_UNAVAILABLE" });
  const env = { BIAWS_MCP_SERVICE_SECRET: "a".repeat(40) };
  assert.throws(() => requireMcpServiceSecret("wrong", env), { code: "MCP_SERVICE_FORBIDDEN" });
  requireMcpServiceSecret(env.BIAWS_MCP_SERVICE_SECRET, env);
  assert.notEqual(hashDelegation("opaque-token"), "opaque-token");
});
test("delegation binds audience grant and scopes and cannot outlive its source token", () => {
  const now = 100000,
    resource = "https://biaws.example.test/mcp";
  const claims = {
    active: true,
    sub: "user",
    client_id: "client",
    aud: resource,
    exp: 110,
    biaws_grant_id: "grant",
    biaws_workspace_id: "workspace",
    scope: "mcp:read",
  };
  assert.equal(mcpSubjectClaims(claims, resource, now).expiresAt.getTime(), 110000);
  assert.throws(() => mcpSubjectClaims({ ...claims, aud: "https://other.example.test/mcp" }, resource, now));
  assert.throws(() => mcpSubjectClaims({ ...claims, exp: 99 }, resource, now));
  assert.throws(() => mcpSubjectClaims({ ...claims, scope: "mcp:write" }, resource, now));
});
