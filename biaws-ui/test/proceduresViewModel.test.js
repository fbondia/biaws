import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProcedureCollectionsPanelWidth,
  PROCEDURE_COLLECTIONS_PANEL_WIDTH,
} from "../src/components/procedures/ProceduresView/model.js";

test("procedure collections panel width is normalized within its resize limits", () => {
  assert.equal(
    normalizeProcedureCollectionsPanelWidth("invalid"),
    PROCEDURE_COLLECTIONS_PANEL_WIDTH.default,
  );
  assert.equal(
    normalizeProcedureCollectionsPanelWidth(null),
    PROCEDURE_COLLECTIONS_PANEL_WIDTH.default,
  );
  assert.equal(
    normalizeProcedureCollectionsPanelWidth(100),
    PROCEDURE_COLLECTIONS_PANEL_WIDTH.min,
  );
  assert.equal(normalizeProcedureCollectionsPanelWidth(347.6), 348);
  assert.equal(
    normalizeProcedureCollectionsPanelWidth(900),
    PROCEDURE_COLLECTIONS_PANEL_WIDTH.max,
  );
});
