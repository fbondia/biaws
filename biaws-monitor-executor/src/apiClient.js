export class ExecutorApiError extends Error {
  constructor(message, { code, statusCode, retryable, cause } = {}) {
    super(message, { cause });
    this.name = "ExecutorApiError";
    this.code = code || "EXECUTOR_API_ERROR";
    this.statusCode = statusCode;
    this.retryable = Boolean(retryable);
  }
}

function joinUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/+$/u, "")}${path}`;
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function createExecutorApiClient(
  { apiUrl, apiKey, workspaceId, requestTimeoutMs },
  { fetchImpl = fetch } = {},
) {
  async function request(path, body, { signal } = {}) {
    const timeout = AbortSignal.timeout(requestTimeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let response;
    try {
      response = await fetchImpl(joinUrl(apiUrl, path), {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Biaws-Workspace-Id": workspaceId,
        },
        body: JSON.stringify(body),
        signal: requestSignal,
      });
    } catch (error) {
      throw new ExecutorApiError("Executor API request failed", {
        code:
          error?.name === "TimeoutError" ? "API_TIMEOUT" : "API_UNAVAILABLE",
        retryable: true,
        cause: error,
      });
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ExecutorApiError(
        data?.error?.message || `Executor API returned HTTP ${response.status}`,
        {
          code: data?.error?.code,
          statusCode: response.status,
          retryable: isRetryableStatus(response.status),
        },
      );
    }
    return data;
  }

  return {
    acquire(payload, options) {
      return request("/api/monitoring/executor/leases", payload, options);
    },
    renew(leaseToken, payload, options) {
      return request(
        `/api/monitoring/executor/leases/${encodeURIComponent(leaseToken)}/renew`,
        payload,
        options,
      );
    },
    publish(leaseToken, payload, options) {
      return request(
        `/api/monitoring/executor/leases/${encodeURIComponent(leaseToken)}/results`,
        payload,
        options,
      );
    },
  };
}
