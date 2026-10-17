import { createAuthEndpoint, APIError } from "better-auth/api";
import { getOAuthProviderApi } from "@better-auth/oauth-provider";
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
            if (!initializedProvider) throw new APIError("SERVICE_UNAVAILABLE", { error: "server_error" });
            const provider = getOAuthProviderApi(ctx, initializedProvider.options);
            const claims = await provider.requireActiveAccessToken(ctx.body.subject_token);
            return ctx.json(await issueMcpDelegation(claims, resource));
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
