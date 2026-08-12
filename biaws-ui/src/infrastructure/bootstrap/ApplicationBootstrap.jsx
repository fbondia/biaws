import App from "../../App/index.jsx";
import { InfrastructureProvider } from "./InfrastructureProvider.jsx";

export function ApplicationBootstrap() {
  return (
    <InfrastructureProvider>
      {({ actor, onSignOut, onWorkspaceChange }) => (
        <App
          actor={actor}
          key={actor.workspaceId}
          onSignOut={onSignOut}
          onWorkspaceChange={onWorkspaceChange}
        />
      )}
    </InfrastructureProvider>
  );
}
