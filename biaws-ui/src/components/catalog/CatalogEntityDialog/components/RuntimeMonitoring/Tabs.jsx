import { useState } from "react";

const MONITORING_TABS = [
  ["configuration", "Configurações"],
  ["history", "Histórico"],
];

export function RuntimeMonitoringTabs({ configuration, history }) {
  const [activeTab, setActiveTab] = useState("configuration");
  const content = { configuration, history };

  function navigateTabs(event, currentIndex) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    event.preventDefault();
    const lastIndex = MONITORING_TABS.length - 1;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? lastIndex
          : event.key === "ArrowLeft"
            ? (currentIndex - 1 + MONITORING_TABS.length) %
              MONITORING_TABS.length
            : (currentIndex + 1) % MONITORING_TABS.length;
    const nextTab = MONITORING_TABS[nextIndex][0];
    setActiveTab(nextTab);
    event.currentTarget.parentElement
      ?.querySelector(`#runtime-monitoring-tab-${nextTab}`)
      ?.focus();
  }

  return (
    <div className="catalogMonitoringWorkspace catalogWideField">
      <div
        aria-label="Seções de monitoramento"
        className="catalogMonitoringTabs"
        role="tablist"
      >
        {MONITORING_TABS.map(([key, label], index) => (
          <button
            aria-controls="runtime-monitoring-panel"
            aria-selected={activeTab === key}
            className={
              activeTab === key
                ? "catalogMonitoringTab activeCatalogMonitoringTab"
                : "catalogMonitoringTab"
            }
            id={`runtime-monitoring-tab-${key}`}
            key={key}
            onClick={() => setActiveTab(key)}
            onKeyDown={(event) => navigateTabs(event, index)}
            role="tab"
            tabIndex={activeTab === key ? 0 : -1}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <section
        aria-labelledby={`runtime-monitoring-tab-${activeTab}`}
        className="catalogMonitoringPanel"
        id="runtime-monitoring-panel"
        role="tabpanel"
      >
        {content[activeTab]}
      </section>
    </div>
  );
}
