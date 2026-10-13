const RETRY_DELAYS = [1000, 2000, 4000];

function canRetry(error) {
  const status = Number(error?.statusCode);
  return !status || status >= 500 || [408, 429].includes(status);
}

export function createRuntimeOptionListsLoader({
  apply,
  load,
  onError = () => {},
  retryDelays = RETRY_DELAYS,
  schedule = setTimeout,
  cancel = clearTimeout,
}) {
  let active = true;
  let version = 0;
  let retryTimer;
  let pending = false;
  let retryableFailure = false;

  function cancelRetry() {
    if (retryTimer !== undefined) cancel(retryTimer);
    retryTimer = undefined;
  }

  async function startLoad(attempt = 0) {
    if (!active) return false;
    cancelRetry();
    const requestVersion = ++version;
    pending = true;
    try {
      const payload = await load();
      if (!active || requestVersion !== version) return false;
      apply(payload.items || []);
      retryableFailure = false;
      return true;
    } catch (error) {
      if (!active || requestVersion !== version) return false;
      retryableFailure = canRetry(error);
      onError(error);
      if (retryableFailure && attempt < retryDelays.length) {
        retryTimer = schedule(() => {
          retryTimer = undefined;
          if (active && requestVersion === version) {
            startLoad(attempt + 1).catch(() => {});
          }
        }, retryDelays[attempt]);
      }
      throw error;
    } finally {
      if (requestVersion === version) pending = false;
    }
  }

  return Object.freeze({
    dispose() {
      active = false;
      version += 1;
      cancelRetry();
    },
    load: () => startLoad(),
    retry() {
      return retryableFailure && !pending ? startLoad() : Promise.resolve(false);
    },
  });
}
