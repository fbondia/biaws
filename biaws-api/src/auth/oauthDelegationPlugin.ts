import { createAuthEndpoint, APIError } from "better-auth/api";
import { getOAuthProviderApi } from "@better-auth/oauth-provider";
import { z } from "zod";
import { oauthGrantHooks } from "./oauthGrantHooks.js";
import { createMcpOAuthOptions } from "./oauthProvider.js";
import { requireMcpServiceSecret } from "./oauthDelegationPolicy.js";
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
            const provider = getOAuthProviderApi(ctx, createMcpOAuthOptions(resource, oauthGrantHooks));
            const claims = await provider.requireActiveAccessToken(ctx.body.subject_token);
            return ctx.json(await issueMcpDelegation(claims, resource));
          } catch (error) {
            const e = error as { statusCode?: number; code?: string };
            if (e.statusCode)
              throw new APIError(
                e.statusCode === 403 ? "FORBIDDEN" : e.statusCode === 503 ? "SERVICE_UNAVAILABLE" : "UNAUTHORIZED",
                { error: "invalid_token", error_description: "MCP delegation could not be authorized." },
              );
            throw error;
          }
        },
      ),
    },
  } as const;
}
