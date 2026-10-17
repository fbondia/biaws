import { Fragment } from "react";
import { MessagesProvider } from "../../src/infrastructure/messages/MessagesProvider.jsx";
import { createRoot } from "react-dom/client";

import App from "../../src/App/index.jsx";
import { AuthGate } from "../../src/components/auth/AuthGate.jsx";
import { configureApiSession } from "../../src/api/client.js";
import { SessionProvider } from "../../src/infrastructure/session/SessionProvider.jsx";
import { createSessionService } from "../../src/infrastructure/session/service.js";
import { clearSessionScopedState } from "../../src/infrastructure/session/scopedState.js";
import { createFakeSessionAdapter } from "../../src/infrastructure/session/testing.js";

export { navigate } from "../../src/navigation/location.js";
export { act } from "react";
export { clearSessionScopedState };

export async function mountApp(element, options = {}) {
  const actor = options.actor || {
    id: "synthetic-actor",
    workspaceId: "synthetic-workspace",
    permissions: ["issues.read"],
  };
  const fake = createFakeSessionAdapter({ actor, workspaceId: actor.workspaceId });
  const service = createSessionService({
    adapter: options.resolveActor
      ? { ...fake.adapter, restore: async () => options.resolveActor(fake.adapter.getWorkspaceId()) }
      : fake.adapter,
    clearSensitiveState: clearSessionScopedState,
  });
  const disconnect = configureApiSession({
    getWorkspaceId: fake.adapter.getWorkspaceId,
    onUnauthorized: fake.expire,
  });
  await service.initialize();
  const root = createRoot(element);
  const Wrapper = options.messages ? MessagesProvider : Fragment;
  root.render(
    <Wrapper>
      <SessionProvider service={service}>
        <AuthGate>
          {({ actor: currentActor, onSignOut, onWorkspaceChange }) => (
            <App
              actor={currentActor}
              key={currentActor.workspaceId}
              onSignOut={onSignOut}
              onWorkspaceChange={onWorkspaceChange}
            />
          )}
        </AuthGate>
      </SessionProvider>
    </Wrapper>,
  );
  return { root, service, fake, disconnect };
}
