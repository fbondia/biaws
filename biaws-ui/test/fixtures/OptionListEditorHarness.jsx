import { createRoot } from "react-dom/client";

import { ListEditor } from "../../src/components/settings/OptionListsView/components/ListEditor/index.jsx";

const OPTION_LIST = {
  key: "issue.type",
  name: "Tipos de chamados",
  defaultValue: "incident",
  items: [
    {
      value: "incident",
      label: "Incidente",
      active: true,
      order: 10,
      metadata: {
        emlImport: { enabled: false, subjectPatterns: [] },
      },
    },
  ],
};

export function mountOptionListEditor(container) {
  const root = createRoot(container);
  root.render(
    <ListEditor
      canManage
      currentWorkspaceId="workspace-1"
      list={OPTION_LIST}
      onSaved={() => {}}
      workspaces={[{ id: "workspace-1", name: "Principal" }]}
    />,
  );
  return { root };
}
