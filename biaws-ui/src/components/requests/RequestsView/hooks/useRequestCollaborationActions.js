import {
  createRequestNote,
  createRequestTask,
  createRequestTaskNote,
  deleteRequestNote,
  deleteRequestTask,
  deleteRequestTaskNote,
  saveRequestNote,
  saveRequestTask,
  saveRequestTaskNote,
} from "../../../../api.js";

export function useRequestCollaborationActions({
  selectedRequest,
  setRequestError,
  setSavingRequestId,
  upsertRequestInList,
}) {
  async function addRequestNote(note) {
    if (!selectedRequest?.id) return false;

    setSavingRequestId(selectedRequest.id);
    setRequestError("");

    try {
      const payload = await createRequestNote(selectedRequest.id, note);
      if (payload.request) upsertRequestInList(payload.request);
      return true;
    } catch (error) {
      setRequestError(error.message);
      return false;
    } finally {
      setSavingRequestId((current) =>
        current === selectedRequest.id ? "" : current,
      );
    }
  }

  async function updateRequestNote(noteId, note) {
    if (!selectedRequest?.id || !noteId) return false;

    setSavingRequestId(selectedRequest.id);
    setRequestError("");

    try {
      const payload = await saveRequestNote(selectedRequest.id, noteId, note);
      if (payload.request) upsertRequestInList(payload.request);
      return true;
    } catch (error) {
      setRequestError(error.message);
      return false;
    } finally {
      setSavingRequestId((current) =>
        current === selectedRequest.id ? "" : current,
      );
    }
  }

  async function removeRequestNote(noteId) {
    if (!selectedRequest?.id || !noteId) return false;

    setSavingRequestId(selectedRequest.id);
    setRequestError("");

    try {
      const payload = await deleteRequestNote(selectedRequest.id, noteId);
      if (payload.request) upsertRequestInList(payload.request);
      return true;
    } catch (error) {
      setRequestError(error.message);
      return false;
    } finally {
      setSavingRequestId((current) =>
        current === selectedRequest.id ? "" : current,
      );
    }
  }

  async function addRequestTask(task) {
    if (!selectedRequest?.id) return false;

    setSavingRequestId(selectedRequest.id);
    setRequestError("");
    try {
      const payload = await createRequestTask(selectedRequest.id, task);
      if (payload.request) upsertRequestInList(payload.request);
      return true;
    } catch (error) {
      setRequestError(error.message);
      return false;
    } finally {
      setSavingRequestId((current) =>
        current === selectedRequest.id ? "" : current,
      );
    }
  }

  async function updateRequestTask(taskId, task) {
    if (!selectedRequest?.id || !taskId) return false;

    setSavingRequestId(selectedRequest.id);
    setRequestError("");
    try {
      const payload = await saveRequestTask(selectedRequest.id, taskId, task);
      if (payload.request) upsertRequestInList(payload.request);
      return true;
    } catch (error) {
      setRequestError(error.message);
      return false;
    } finally {
      setSavingRequestId((current) =>
        current === selectedRequest.id ? "" : current,
      );
    }
  }

  async function removeRequestTask(taskId) {
    if (!selectedRequest?.id || !taskId) return false;

    setSavingRequestId(selectedRequest.id);
    setRequestError("");
    try {
      const payload = await deleteRequestTask(selectedRequest.id, taskId);
      if (payload.request) upsertRequestInList(payload.request);
      return true;
    } catch (error) {
      setRequestError(error.message);
      return false;
    } finally {
      setSavingRequestId((current) =>
        current === selectedRequest.id ? "" : current,
      );
    }
  }

  async function addRequestTaskNote(taskId, note) {
    if (!selectedRequest?.id || !taskId) return false;
    setSavingRequestId(selectedRequest.id);
    setRequestError("");
    try {
      const payload = await createRequestTaskNote(
        selectedRequest.id,
        taskId,
        note,
      );
      if (payload.request) upsertRequestInList(payload.request);
      return true;
    } catch (error) {
      setRequestError(error.message);
      return false;
    } finally {
      setSavingRequestId((current) =>
        current === selectedRequest.id ? "" : current,
      );
    }
  }

  async function updateRequestTaskNote(taskId, noteId, note) {
    if (!selectedRequest?.id || !taskId || !noteId) return false;
    setSavingRequestId(selectedRequest.id);
    setRequestError("");
    try {
      const payload = await saveRequestTaskNote(
        selectedRequest.id,
        taskId,
        noteId,
        note,
      );
      if (payload.request) upsertRequestInList(payload.request);
      return true;
    } catch (error) {
      setRequestError(error.message);
      return false;
    } finally {
      setSavingRequestId((current) =>
        current === selectedRequest.id ? "" : current,
      );
    }
  }

  async function removeRequestTaskNote(taskId, noteId) {
    if (!selectedRequest?.id || !taskId || !noteId) return false;
    setSavingRequestId(selectedRequest.id);
    setRequestError("");
    try {
      const payload = await deleteRequestTaskNote(
        selectedRequest.id,
        taskId,
        noteId,
      );
      if (payload.request) upsertRequestInList(payload.request);
      return true;
    } catch (error) {
      setRequestError(error.message);
      return false;
    } finally {
      setSavingRequestId((current) =>
        current === selectedRequest.id ? "" : current,
      );
    }
  }

  return {
    addRequestNote,
    addRequestTask,
    addRequestTaskNote,
    removeRequestNote,
    removeRequestTask,
    removeRequestTaskNote,
    updateRequestNote,
    updateRequestTask,
    updateRequestTaskNote,
  };
}
