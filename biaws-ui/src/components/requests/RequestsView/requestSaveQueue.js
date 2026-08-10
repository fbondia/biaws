export function flushPendingRequestSaves({
  timers,
  pendingRequests,
  persist,
  clearTimer = clearTimeout,
}) {
  for (const timeoutId of timers.values()) clearTimer(timeoutId);

  const requests = [...pendingRequests.values()];
  timers.clear();
  pendingRequests.clear();

  return Promise.allSettled(requests.map((request) => persist(request)));
}
