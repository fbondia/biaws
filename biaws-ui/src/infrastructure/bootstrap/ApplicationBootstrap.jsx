import App from "../../App/index.jsx";
import { OAuthConnectPage } from "../../components/auth/OAuthConnectPage/index.jsx";
import { InfrastructureProvider } from "./InfrastructureProvider.jsx";

export function ApplicationBootstrap() {
  const oauth = window.location.pathname === "/oauth/connect";
  return (
    <InfrastructureProvider requireWorkspace={!oauth}>
      {({ actor, onSignOut, onWorkspaceChange }) =>
        oauth ? (
          <OAuthConnectPage actor={actor} />
        ) : (
          <App actor={actor} key={actor.workspaceId} onSignOut={onSignOut} onWorkspaceChange={onWorkspaceChange} />
        )
      }
    </InfrastructureProvider>
  );
}
