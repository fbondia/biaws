import { createAuthEndpoint, APIError } from "better-auth/api";
import { getOAuthProviderApi } from "@better-auth/oauth-provider";
import { getDpopJktFromPayload, verifyJwsAccessToken } from "better-auth/oauth2";
import { z } from "zod";
import { requireMcpServiceSecret, classifyMcpDelegationFailure } from "./oauthDelegationPolicy.js";
import { issueMcpDelegation } from "./oauthDelegations.js";

export function createOAuthDelegationPlugin(resource: string) {
  return {
    id: "biaws-mcp-delegation",
    endpoints: {
      delegateMcp: createAuthEndpoint(
        "/mcp/delegate",
        {
          method: "POST",
          body: z.object({ subject_token: z.string().min(1).max(16384) }).strict(),
        },
        async (ctx) => {
          try {
            requireMcpServiceSecret(ctx.headers?.get("x-biaws-mcp-service-secret") ?? null);
            // Companion plugins register CIMD discovery on the initialized
            // provider. Recreating its options loses those client resolvers.
            const initializedProvider = ctx.context.getPlugin("oauth-provider");
            const jwtPlugin = ctx.context.getPlugin("jwt");
            if (!initializedProvider || !jwtPlugin)
              throw new APIError("SERVICE_UNAVAILABLE", { error: "server_error" });
            const provider = getOAuthProviderApi(ctx, initializedProvider.options);
            // The connection grant, rather than the originating browser session,
            // owns MCP access. Provider introspection would reject its signed sid
            // after logout/expiry even though offline_access can still refresh.
            const claims = await verifyJwsAccessToken(ctx.body.subject_token, {
              jwksFetch: () => jwtPlugin.endpoints.getJwks({ context: ctx.context }),
              jwksCacheKey: jwtPlugin,
              verifyOptions: {
                issuer: jwtPlugin.options?.jwt?.issuer ?? ctx.context.baseURL,
                audience: resource,
                typ: "at+jwt",
                requiredClaims: ["sub", "exp", "iat", "client_id", "scope", "jti"],
              },
            });
            // This bridge accepts bearer tokens only; it has no original MCP
            // request/proof with which to validate a sender-constrained token.
            if (getDpopJktFromPayload(claims) || typeof claims.client_id !== "string")
              throw new APIError("UNAUTHORIZED", { error: "invalid_token" });
            const client = await provider.getClient(claims.client_id);
            if (!client || client.disabled) throw new APIError("UNAUTHORIZED", { error: "invalid_token" });
            return ctx.json(await issueMcpDelegation({ ...claims, active: true }, resource));
          } catch (error) {
            const failure = classifyMcpDelegationFailure(error);
            if (failure)
              throw new APIError(failure.status, {
                error: failure.error,
                error_description: "MCP delegation could not be authorized.",
              });
            throw error;
          }
        },
      ),
    },
  } as const;
}
