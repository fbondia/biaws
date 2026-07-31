import { LoaderCircle } from "lucide-react";

import { JourneyCalendar } from "../../JourneyCalendar.jsx";
import { RequestSchedule } from "../../RequestSchedule.jsx";
import { RequestTasksOverview } from "../../RequestTasksOverview.jsx";
import { REQUEST_OVERVIEW_TABS } from "../../requestUtils.js";

export function RequestsOverview({
  activeTab,
  journeyMonths,
  journeyRequests,
  loading,
  onSelectRequest,
  onTabChange,
  scheduleRequests,
  taskRequests,
}) {
  return (
    <div className="requestWorkArea">
      <section className="requestPanel" aria-busy={loading}>
        <div className="panelHeader">
          <div>
            <h3>Acompanhamento</h3>
            <span>
              Visão consolidada de tarefas, prazos e jornadas das melhorias
              listadas
            </span>
          </div>
        </div>

        <div
          className="detailTabs requestOverviewTabs"
          role="tablist"
          aria-label="Visões gerais das melhorias"
        >
          {REQUEST_OVERVIEW_TABS.map((tab) => (
            <button
              aria-selected={activeTab === tab.key}
              className={
                activeTab === tab.key
                  ? "detailTab activeDetailTab"
                  : "detailTab"
              }
              disabled={loading}
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div
            className="requestLoadingState requestOverviewLoadingState"
            role="status"
          >
            <LoaderCircle aria-hidden="true" className="spinIcon" size={28} />
            <span>Carregando acompanhamento...</span>
          </div>
        ) : null}

        {!loading && activeTab === "journeys" ? (
          <JourneyCalendar
            months={journeyMonths}
            onSelectRequest={onSelectRequest}
            requests={journeyRequests}
          />
        ) : null}

        {!loading && activeTab === "schedule" ? (
          <RequestSchedule
            onSelectRequest={onSelectRequest}
            requests={scheduleRequests}
          />
        ) : null}

        {!loading && activeTab === "tasks" ? (
          <RequestTasksOverview
            onSelectRequest={onSelectRequest}
            requests={taskRequests}
          />
        ) : null}
      </section>
    </div>
  );
}
