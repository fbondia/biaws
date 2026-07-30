let nextOperationId = 0;
let operations = [];
const listeners = new Set();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeToLoading(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLoadingSnapshot() {
  return operations;
}

export function startGlobalLoading(label = "Carregando…", options = {}) {
  nextOperationId += 1;
  const operation = {
    id: nextOperationId,
    label,
    priority: options.priority ?? 10,
  };
  operations = [...operations, operation];
  notify();

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    operations = operations.filter(({ id }) => id !== operation.id);
    notify();
  };
}

export async function runWithGlobalLoading(operation, label, options) {
  const finish = startGlobalLoading(label, options);
  try {
    return await operation();
  } finally {
    finish();
  }
}
