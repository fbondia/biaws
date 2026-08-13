export function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    const error = new Error("Provider execution timed out");
    error.name = "TimeoutError";
    error.code = "PROVIDER_TIMEOUT";
    controller.abort(error);
  }, timeoutMs);
  timer.unref?.();
  return { controller, clear: () => clearTimeout(timer) };
}

export async function runWithSignal(promise, signal) {
  if (signal.aborted) throw signal.reason;
  let rejectOnAbort;
  const aborted = new Promise((_resolve, reject) => {
    rejectOnAbort = () => reject(signal.reason);
    signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    signal.removeEventListener("abort", rejectOnAbort);
  }
}
