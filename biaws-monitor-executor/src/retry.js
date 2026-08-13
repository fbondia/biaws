export function abortableSleep(delayMs, signal) {
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, delayMs);
    timer.unref?.();
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

export async function retryWithBackoff(
  operation,
  {
    attempts,
    baseMs,
    maxMs,
    random = Math.random,
    sleep = abortableSleep,
    shouldRetry = () => true,
    onRetry = () => {},
    signal,
  },
) {
  for (let attempt = 1; ; attempt += 1) {
    if (signal?.aborted) throw signal.reason;
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= attempts || !shouldRetry(error)) throw error;
      const ceiling = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
      const delayMs = Math.max(1, Math.round(ceiling * (0.5 + random() * 0.5)));
      onRetry({ attempt, delayMs, error });
      await sleep(delayMs, signal);
    }
  }
}
