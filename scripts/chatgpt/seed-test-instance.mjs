import { randomBytes } from "node:crypto";
import { getAuth } from "./dist/biaws-api/src/auth/auth.js";
import { getMongoDatabase, closeMongoClient } from "./dist/biaws-api/src/helpers/mongoClient.js";
import { createWorkspace, createApplication } from "./dist/biaws-api/src/repositories/catalog/index.js";
import { createPermissionGroup, setUserGroups } from "./dist/biaws-api/src/repositories/access/index.js";
if (!process.env.MONGO_DB?.startsWith("biaws_chatgpt_test_")) throw new Error("Refusing non-test database");
const auth = await getAuth(),
  operator = { userId: "synthetic-test-operator" };
const users = [];
for (let i = 0; i < 2; i++) {
  const password = randomBytes(24).toString("hex"),
    email = "synthetic-" + i + "@example.test";
  const created = await auth.api.createUser({ body: { email, password, name: "Synthetic " + i } });
  users.push({ userId: created.user.id, email, password });
}
const workspaces = [];
for (const label of ["a", "b"]) {
  const workspace = await createWorkspace({ key: "test-" + label, name: "Synthetic " + label }, operator);
  const apps = [];
  for (const number of [1, 2])
    apps.push(
      await createApplication(
        workspace.id,
        { key: "app-" + label + number, name: "Synthetic " + label + number },
        operator,
      ),
    );
  const bindings = [];
  for (let i = 0; i < 2; i++) {
    const group = await createPermissionGroup(
      {
        workspaceId: workspace.id,
        name: "Synthetic group " + i,
        permissions: [
          "applications.read",
          "issues.read",
          "issues.create",
          "secrets.metadata.read",
          "secrets.value.reveal",
        ],
        scope: { type: "applications", applicationIds: [apps[i].id] },
      },
      { ...operator, workspaceId: workspace.id },
    );
    await setUserGroups(users[i].userId, [group.id], { ...operator, workspaceId: workspace.id });
    bindings.push(group.id);
  }
  workspaces.push({ id: workspace.id, apps: apps.map((app) => app.id), groups: bindings });
}
console.log(JSON.stringify({ users, workspaces }));
await closeMongoClient();
