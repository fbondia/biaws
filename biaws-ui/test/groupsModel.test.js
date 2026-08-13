import assert from "node:assert/strict";
import test from "node:test";

import { groupPermissionsBySection } from "../src/components/auth/GroupsView/model.js";

test("permissions are grouped by configured section in catalog order", () => {
  const permissions = [
    { id: "issues.read", section: "Geral" },
    { id: "issues.comment.create", section: "Comentários" },
    { id: "issues.update", section: "Geral" },
    { id: "issues.attachment.read", section: "Anexos" },
  ];

  assert.deepEqual(groupPermissionsBySection(permissions), [
    ["Geral", [permissions[0], permissions[2]]],
    ["Comentários", [permissions[1]]],
    ["Anexos", [permissions[3]]],
  ]);
});
