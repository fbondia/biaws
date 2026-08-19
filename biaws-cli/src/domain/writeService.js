import { CliError } from "../core/errors.js";

const SCHEMA_VERSION = "biaws.write.v1";

function referenceOf(item) {
  return String(item?.id || item?._id || item?.code || "");
}

export function findTask(payload, reference) {
  const request = payload.request || payload;
  const matches = (request.tasks || []).filter(
    (task) =>
      referenceOf(task) === String(reference) ||
      String(task.code || "") === String(reference),
  );
  if (matches.length === 0) {
    throw new CliError(`Tarefa ${reference} não encontrada na melhoria.`, {
      code: "TASK_NOT_FOUND",
      exitCode: 4,
    });
  }
  if (matches.length > 1) {
    throw new CliError(
      `A referência ${reference} identifica mais de uma tarefa.`,
      {
        code: "AMBIGUOUS_TASK_REFERENCE",
        exitCode: 2,
      },
    );
  }
  return { request, task: matches[0] };
}

export function writeEnvelope(resource, operation, result) {
  return {
    schemaVersion: SCHEMA_VERSION,
    resource,
    operation,
    scope: {
      workspaceId: result.workspaceId || null,
      applicationId: result.applicationId || null,
      requestId: result.requestId || null,
    },
    changed: result.changed,
    previousStatus: result.previousStatus,
    status: result.status,
    data: result.data,
  };
}

function exitCodeForStatus(status) {
  if (status === 404) return 4;
  if (status === 403) return 3;
  if (status === 401 || status === 422 || status === 409) return 2;
  return 1;
}

function writeErrorCodeForStatus(status) {
  const codes = {
    403: "PERMISSION_DENIED",
    404: "RESOURCE_NOT_FOUND",
    409: "WRITE_CONFLICT",
    422: "INVALID_TRANSITION",
  };
  return codes[status] || "API_WRITE_FAILED";
}

export function asWriteCliError(error, resource) {
  if (error instanceof CliError) return error;
  const status = error?.statusCode;
  return new CliError(`${resource}: ${error.message}`, {
    cause: error,
    code: error?.code || writeErrorCodeForStatus(status),
    exitCode: exitCodeForStatus(status),
  });
}

export class DomainWriteService {
  constructor(api) {
    this.api = api;
  }

  async demand(id) {
    try {
      return await this.api.request(`/requests/${encodeURIComponent(id)}`);
    } catch (error) {
      if (error?.statusCode !== 404) throw error;
      const query = new URLSearchParams({ code: String(id), limit: "2" });
      const payload = await this.api.request(`/requests?${query}`);
      const matches = (payload.items || []).filter(
        (item) => String(item.clientCode || "") === String(id),
      );
      if (matches.length === 1) return { request: matches[0] };
      if (matches.length > 1) {
        throw new CliError(`Código de melhoria ambíguo: ${id}.`, {
          code: "AMBIGUOUS_DEMAND_CODE",
          exitCode: 2,
        });
      }
      throw error;
    }
  }

  issue(id) {
    return this.api.request(`/issues/${encodeURIComponent(id)}`);
  }

  updateTaskStatus(demandId, taskId, status) {
    return this.api.request(
      `/requests/${encodeURIComponent(demandId)}/tasks/${encodeURIComponent(taskId)}`,
      { method: "PUT", body: JSON.stringify({ status }) },
    );
  }

  updateIssueStatus(issueId, status) {
    return this.api.request(`/issues/${encodeURIComponent(issueId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }
}
