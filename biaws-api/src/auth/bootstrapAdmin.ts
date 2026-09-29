import { COLLECTION_NAMES } from "../database/collectionNames.js";
import type { BootstrapAdminAuth, BootstrapDatabase } from "./bootstrapTypes.js";
import { bootstrapUserId } from "./bootstrapTypes.js";

export async function bootstrapAdmin({
  auth,
  database,
  email,
  password,
  name,
  log = console.log,
  assignAdministration,
}: {
  auth: BootstrapAdminAuth;
  database: BootstrapDatabase;
  email: string;
  password: string;
  name: string;
  log?: (value: string) => void;
  assignAdministration?: (userId: string) => Promise<unknown>;
}) {
  if (password.length < 12 || password.length > 128) {
    throw new Error("Administrator password must contain between 12 and 128 characters.");
  }

  const existingAdmin = await database.collection(COLLECTION_NAMES.AUTH_USERS).findOne({
    role: { $regex: "(^|,)admin(,|$)" },
    banned: { $ne: true },
  });

  if (existingAdmin) {
    await assignAdministration?.(bootstrapUserId(existingAdmin));
    log("An active Better Auth administrator already exists; no changes made.");
    return { created: false, user: existingAdmin };
  }

  const result = await auth.api.createUser({
    body: {
      email: email.toLowerCase(),
      password,
      name,
      role: "admin",
    },
  });

  await assignAdministration?.(bootstrapUserId(result.user));
  log(`Better Auth administrator created: ${result.user.email}`);
  return { created: true, user: result.user };
}
