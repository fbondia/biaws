import { MESSAGE_DIALOG, MESSAGE_LEVEL } from "./contract.js";

const DEFAULT_NOTICE_DURATION = 5000;

function normalizeText(value, fallback = "") {
  if (typeof value === "string") return value;
  return value?.message || fallback;
}

function normalizeDialogOptions(input, defaults) {
  const options = typeof input === "string" ? { message: input } : input || {};
  return Object.freeze({ ...defaults, ...options });
}

export function selectActiveLoading(operations, blocking) {
  return operations
    .filter((operation) => operation.blocking === blocking)
    .reduce(
      (selected, operation) =>
        !selected || operation.priority >= selected.priority
          ? operation
          : selected,
      null,
    );
}

export function createMessagesService({
  clearTimeoutFn = clearTimeout,
  setTimeoutFn = setTimeout,
} = {}) {
  let nextId = 0;
  let snapshot = Object.freeze({
    dialog: null,
    loadings: Object.freeze([]),
    notices: Object.freeze([]),
  });
  const listeners = new Set();
  const dialogQueue = [];
  const noticeTimers = new Map();

  function publish(changes) {
    snapshot = Object.freeze({ ...snapshot, ...changes });
    for (const listener of listeners) listener();
  }

  function removeNotice(id) {
    const timer = noticeTimers.get(id);
    if (timer) clearTimeoutFn(timer);
    noticeTimers.delete(id);
    publish({
      notices: Object.freeze(
        snapshot.notices.filter((notice) => notice.id !== id),
      ),
    });
  }

  function notify(level, message, options = {}) {
    const text = normalizeText(message);
    if (!text) return null;
    const id = ++nextId;
    const notice = Object.freeze({ id, level, message: text });
    publish({ notices: Object.freeze([...snapshot.notices, notice]) });
    const duration = options.duration ?? DEFAULT_NOTICE_DURATION;
    if (duration > 0) {
      noticeTimers.set(
        id,
        setTimeoutFn(() => removeNotice(id), duration),
      );
    }
    return Object.freeze({ id, dismiss: () => removeNotice(id) });
  }

  function showNextDialog() {
    if (snapshot.dialog || !dialogQueue.length) return;
    publish({ dialog: dialogQueue.shift() });
  }

  function requestDialog(type, input, { focusTarget = null } = {}) {
    const defaults =
      type === MESSAGE_DIALOG.CONFIRM
        ? {
            cancelLabel: "Cancelar",
            confirmLabel: "Confirmar",
            title: "Confirmação",
            tone: "default",
          }
        : {
            cancelLabel: "Cancelar",
            confirmLabel: "Continuar",
            inputLabel: "Valor",
            inputType: "text",
            title: "Informe o valor",
          };
    const options = normalizeDialogOptions(input, defaults);

    return new Promise((resolve) => {
      dialogQueue.push(
        Object.freeze({ focusTarget, id: ++nextId, options, resolve, type }),
      );
      showNextDialog();
    });
  }

  function resolveDialog(value) {
    const activeDialog = snapshot.dialog;
    if (!activeDialog) return;
    publish({ dialog: null });
    activeDialog.resolve(value);
    showNextDialog();
  }

  function startLoading(label = "Carregando…", options = {}) {
    const operation = Object.freeze({
      blocking: options.blocking !== false,
      id: ++nextId,
      label,
      priority: options.priority ?? 10,
    });
    publish({ loadings: Object.freeze([...snapshot.loadings, operation]) });

    let finished = false;
    return Object.freeze({
      finish() {
        if (finished) return;
        finished = true;
        publish({
          loadings: Object.freeze(
            snapshot.loadings.filter(({ id }) => id !== operation.id),
          ),
        });
      },
      id: operation.id,
    });
  }

  async function run(operation, label, options) {
    const handle = startLoading(label, options);
    try {
      return await operation();
    } finally {
      handle.finish();
    }
  }

  function dispose() {
    for (const timer of noticeTimers.values()) clearTimeoutFn(timer);
    noticeTimers.clear();
    snapshot.dialog?.resolve(
      snapshot.dialog.type === MESSAGE_DIALOG.CONFIRM ? false : null,
    );
    for (const dialog of dialogQueue) {
      dialog.resolve(dialog.type === MESSAGE_DIALOG.CONFIRM ? false : null);
    }
    dialogQueue.length = 0;
    publish({
      dialog: null,
      loadings: Object.freeze([]),
      notices: Object.freeze([]),
    });
    listeners.clear();
  }

  return Object.freeze({
    cancelDialog() {
      resolveDialog(
        snapshot.dialog?.type === MESSAGE_DIALOG.CONFIRM ? false : null,
      );
    },
    confirm: (options, context) =>
      requestDialog(MESSAGE_DIALOG.CONFIRM, options, context),
    dismiss: removeNotice,
    dispose,
    error: (message, options) => notify(MESSAGE_LEVEL.ERROR, message, options),
    getSnapshot: () => snapshot,
    info: (message, options) => notify(MESSAGE_LEVEL.INFO, message, options),
    prompt: (options, context) =>
      requestDialog(MESSAGE_DIALOG.PROMPT, options, context),
    resolveDialog,
    run,
    startLoading,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    success: (message, options) =>
      notify(MESSAGE_LEVEL.SUCCESS, message, options),
    warning: (message, options) =>
      notify(MESSAGE_LEVEL.WARNING, message, options),
  });
}
