import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App/index.jsx";
import { AuthGate } from "./components/auth/AuthGate.jsx";
import { AccessibilityProvider } from "./components/shared/AccessibilityProvider.jsx";
import { LoadingProvider } from "./components/shared/LoadingProvider.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AccessibilityProvider>
      <LoadingProvider>
        <AuthGate>
          {({ actor, onSignOut, onWorkspaceChange }) => (
            <App
              actor={actor}
              key={actor.workspaceId}
              onSignOut={onSignOut}
              onWorkspaceChange={onWorkspaceChange}
            />
          )}
        </AuthGate>
      </LoadingProvider>
    </AccessibilityProvider>
  </StrictMode>,
);
