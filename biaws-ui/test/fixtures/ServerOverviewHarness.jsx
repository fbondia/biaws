import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { ServerContent } from "../../src/components/catalog/ServersView/components/ServerPanels.jsx";

export function mountServerOverview(element) {
  const root = createRoot(element);
  flushSync(() =>
    root.render(
      <ServerContent
        activeTab="overview"
        actor={{ permissions: [] }}
        onArchive={() => {}}
        onBack={() => {}}
        onDelete={() => {}}
        onEdit={() => {}}
        onRestore={() => {}}
        onSelectTab={() => {}}
        selected={{
          id: "server-1",
          key: "primary-server",
          name: "Servidor principal",
          hostname: "server.example.test",
          addresses: ["192.0.2.10", "2001:db8::10"],
          status: "active",
          location: "São Paulo",
          provider: "Datacenter",
          operatingSystem: "Linux",
          tags: ["produção", "crítico"],
          purpose: "Hospeda os serviços principais.",
          description: "Ambiente **monitorado** continuamente.",
        }}
        serverApplications={[]}
      />,
    ),
  );
  return root;
}
