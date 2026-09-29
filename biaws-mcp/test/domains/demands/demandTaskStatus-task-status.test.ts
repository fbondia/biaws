import assert from "node:assert/strict";
import test from "node:test";
import { updateDemandTaskStatus } from "../../../src/domains/demands/service.js";
import { response } from "./demandTaskStatus.fixtures.js";
test("task status validation is awaited before reading or updating a demand", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.BIAWS_API_URL;
  process.env.BIAWS_API_URL = "http://api.test";
  const paths: string[] = [];
  globalThis.fetch = async (url) => {
    paths.push(new URL(url instanceof Request ? url.url : url).pathname);
    return response({
      items: [
        {
          key: "demand.task-status",
          defaultValue: "Pendente",
          items: [
            { value: "Pendente", active: true },
            { value: "Andamento", active: true },
            { value: "Aguardando Decisão", active: true },
            { value: "Concluído", active: true },
          ],
        },
      ],
    });
  };

  try {
    await assert.rejects(
      () =>
        Reflect.apply(updateDemandTaskStatus, undefined, [
          {
            requestId: "BIAWS-1",
            taskId: "task-1",
            status: "Em andamento",
          },
        ]),
      /status must be one of Pendente, Andamento, Aguardando Decisão, Concluído/u,
    );
    assert.deepEqual(paths, ["/api/option-lists/runtime"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.BIAWS_API_URL;
    else process.env.BIAWS_API_URL = originalBaseUrl;
  }
});
