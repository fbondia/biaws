import { CatalogHistoryTab } from "./CatalogHistoryTab.jsx";
import { CatalogIntegrationsTab } from "./CatalogIntegrationsTab.jsx";
import { CatalogOverviewTab } from "./CatalogOverviewTab.jsx";
import { CatalogRepositoriesTab } from "./CatalogRepositoriesTab.jsx";
import { CatalogTopologyTab } from "./CatalogTopologyTab.jsx";

const TAB_COMPONENTS = {
  overview: CatalogOverviewTab,
  topology: CatalogTopologyTab,
  repositories: CatalogRepositoriesTab,
  history: CatalogHistoryTab,
  integrations: CatalogIntegrationsTab,
};

export function CatalogTabContent(props) {
  const Component = TAB_COMPONENTS[props.activeTab];
  return (
    <div className="catalogTabPanel">
      {Component ? <Component {...props} /> : null}
    </div>
  );
}
