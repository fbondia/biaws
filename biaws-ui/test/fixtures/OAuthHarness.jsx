import { createRoot } from "react-dom/client";
import { act } from "react";
import { OAuthConnectPage } from "../../src/components/auth/OAuthConnectPage/index.jsx";
import { OAuthConnections } from "../../src/components/auth/OAuthConnections/index.jsx";
export { act };
export function mount(element, account = false) {
  const root = createRoot(element);
  const actor = {
    email: "synthetic@example.test",
    workspaces: [
      { id: "one", name: "Primeiro" },
      { id: "two", name: "Segundo" },
    ],
  };
  root.render(account ? <OAuthConnections actor={actor} /> : <OAuthConnectPage actor={actor} />);
  return root;
}
