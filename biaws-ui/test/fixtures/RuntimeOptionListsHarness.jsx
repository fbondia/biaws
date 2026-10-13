import { createRoot } from "react-dom/client";

import App from "../../src/App/index.jsx";
import { AuthGate } from "../../src/components/auth/AuthGate.jsx";
import { configureApiSession } from "../../src/api/client.js";
import { SessionProvider } from "../../src/infrastructure/session/SessionProvider.jsx";
import { createSessionService } from "../../src/infrastructure/session/service.js";
import { clearSessionScopedState } from "../../src/infrastructure/session/scopedState.js";
import { createFakeSessionAdapter } from "../../src/infrastructure/session/testing.js";

export { act } from "react";
export { clearSessionScopedState };

export async function mountApp(element) {
  const actor = {
    id: "synthetic-actor",
    workspaceId: "synthetic-workspace",
    permissions: ["issues.read"],
  };
  const fake = createFakeSessionAdapter({ actor, workspaceId: actor.workspaceId });
  const service = createSessionService({ adapter: fake.adapter, clearSensitiveState: clearSessionScopedState });
  const disconnect = configureApiSession({
    getWorkspaceId: fake.adapter.getWorkspaceId,
    onUnauthorized: fake.expire,
  });
  await service.initialize();
  const root = createRoot(element);
  root.render(
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
    </SessionProvider>,
  );
  return { root, service, fake, disconnect };
}
