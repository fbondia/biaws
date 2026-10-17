import { useSyncExternalStore } from "react";
import { readRoute } from "./model.js";

const ROUTE_EVENT = "biaws:navigation";
export function subscribeRoute(listener) {
  window.addEventListener("popstate", listener);
  window.addEventListener(ROUTE_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(ROUTE_EVENT, listener);
  };
}
const snapshot = () => `${window.location.pathname}${window.location.search}`;
export function useRoute() {
  useSyncExternalStore(subscribeRoute, snapshot, snapshot);
  return readRoute(window.location);
}
export function navigate(url, { replace = false } = {}) {
  if (url === snapshot()) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", url);
  window.dispatchEvent(new window.Event(ROUTE_EVENT));
}
