import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/tools.js";
import { required } from "../../helpers/types.js";
import { demandId, withApi } from "./demandMutationTools.fixtures.js";
test("note update preserves omitted dates, supports changing dates, and delete resolves codes", async () => {
  await withApi(async (calls) => {
    await dispatchTool("demands_update_note", {
      requestId: "BIAWS-1",
      noteId: " note/1 ",
      content: " Updated ",
    });
    assert.equal(
      required(calls.at(-1)).path,
      `/api/requests/${demandId}/notes/note%2F1`,
    );
    assert.deepEqual(required(calls.at(-1)).body, {
      content: "Updated",
      date: "2026-09-10",
    });
    await dispatchTool("demands_update_note", {
      requestId: demandId,
      noteId: "note/1",
      content: "Changed",
      date: "2026-09-28",
    });
    assert.equal(required(calls.at(-1)).body.date, "2026-09-28");
    await dispatchTool("demands_delete_note", {
      requestId: "BIAWS-1",
      noteId: "note/1",
    });
    assert.equal(required(calls.at(-1)).method, "DELETE");
    assert.equal(
      required(calls.at(-1)).path,
      `/api/requests/${demandId}/notes/note%2F1`,
    );
  });
});
