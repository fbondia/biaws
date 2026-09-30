import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";

import { JourneyCalendar } from "../../src/components/requests/JourneyCalendar/index.jsx";
import { JourneyBalanceBar } from "../../src/components/requests/JourneyCalendar/components/JourneyBalanceBar.jsx";

export async function mountJourneyBalanceExamples(element) {
  const root = createRoot(element);
  const examples = [
    { planned: 8, executed: 5 },
    { planned: 3, executed: 5 },
    { planned: 4, executed: 0 },
    { planned: 0, executed: 4 },
    { planned: 5, executed: 5 },
    { planned: 0, executed: 0 },
  ];
  flushSync(() => {
    root.render(
      <div className="requestJourneyBalanceExamples">
        {examples.map((totals, index) => (
          <JourneyBalanceBar key={index} totals={totals} />
        ))}
      </div>,
    );
  });
  return {
    async unmount() {
      flushSync(() => root.unmount());
    },
  };
}

export async function mountJourneyCalendar(element, onSelectRequest = () => {}) {
  const root = createRoot(element);
  flushSync(() => {
    root.render(
      <JourneyCalendar
        collections={[
          { id: "platform", name: "Plataforma", parentId: "" },
          { id: "api", name: "API", parentId: "platform" },
        ]}
        currentDate={new Date(2026, 8, 30)}
        months={["2026-08", "2026-09", "2026-10"]}
        onSelectRequest={onSelectRequest}
        requests={[
          {
            id: "pending",
            title: "Melhoria pendente",
            collectionId: "api",
            journeys: [
              { month: "2026-08", plannedJourneys: 8, executedJourneys: 0 },
              { month: "2026-09", plannedJourneys: 2, executedJourneys: 2 },
            ],
          },
          {
            id: "balanced",
            title: "Melhoria balanceada",
            collectionId: "platform",
            journeys: [{ month: "2026-09", plannedJourneys: 3, executedJourneys: 3 }],
          },
          {
            id: "future",
            title: "Melhoria futura",
            journeys: [{ month: "2026-10", plannedJourneys: 4 }],
          },
        ]}
      />,
    );
  });
  return {
    async click(element) {
      flushSync(() => element.click());
    },
    async setNumber(element, value) {
      flushSync(() => {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(element, value);
        element.dispatchEvent(new window.Event("input", { bubbles: true }));
      });
    },
    async unmount() {
      flushSync(() => root.unmount());
    },
  };
}
