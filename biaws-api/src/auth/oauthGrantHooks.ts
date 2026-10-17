import { getOAuthProviderState } from "@better-auth/oauth-provider";
import { authorizeOAuthGrant, findOAuthFlowGrant } from "./oauthGrants.js";
import { oauthError } from "./oauthGrantPolicy.js";

export const oauthGrantHooks = {
  postLogin: {
    page: "/oauth/connect",
    async shouldRedirect({
      user,
      session,
    }: {
      user: { id: string };
      session: { id: string };
    }) {
      const state = await getOAuthProviderState();
      return (
        !state?.query ||
        !(await findOAuthFlowGrant(user.id, session.id, state.query))
      );
    },
    async consentReferenceId({
      user,
      session,
    }: {
      user: { id: string };
      session: { id: string };
    }) {
      const state = await getOAuthProviderState();
      if (!state?.query) throw oauthError("OAUTH_FLOW_MISSING", 400);
      const grant = await findOAuthFlowGrant(user.id, session.id, state.query);
      if (!grant) throw oauthError("OAUTH_WORKSPACE_REQUIRED", 403);
      return grant.id;
    },
  },
  async customAccessTokenClaims({
    user,
    referenceId,
    scopes,
  }: {
    user?: { id: string } | null;
    referenceId?: string;
    scopes: string[];
  }) {
    if (!user || !referenceId) throw oauthError("OAUTH_GRANT_REQUIRED");
    const grant = await authorizeOAuthGrant(referenceId, user.id, scopes);
    return { biaws_grant_id: grant.id, biaws_workspace_id: grant.workspaceId };
  },
};
