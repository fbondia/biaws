import assert from "node:assert/strict";

export async function manualExecutionRetry(scenarioContext) {
  const { request, adminCookie, manualExecutionRoute, manualExecution } = scenarioContext;
  const secondManualExecutionResponse = await request(manualExecutionRoute, {
    cookie: adminCookie,
    method: "POST",
    body: {},
    origin: true,
  });

  assert.equal(secondManualExecutionResponse.status, 202);

  const secondManualExecution = await secondManualExecutionResponse.json();

  assert.equal(secondManualExecution.created, true);

  assert.notEqual(secondManualExecution.execution.id, manualExecution.execution.id);
  return {
    ...scenarioContext,
    secondManualExecutionResponse,
    secondManualExecution,
  };
}
