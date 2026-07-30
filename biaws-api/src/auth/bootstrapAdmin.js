import { COLLECTION_NAMES } from "../database/collectionNames.js";

export async function bootstrapAdmin({
  auth,
  database,
  email,
  password,
  name,
  log = console.log,
  assignAdministration,
}) {
  if (password.length < 12 || password.length > 128) {
    throw new Error(
      "Administrator password must contain between 12 and 128 characters.",
    );
  }

  const existingAdmin = await database
    .collection(COLLECTION_NAMES.AUTH_USERS)
    .findOne({
      role: { $regex: "(^|,)admin(,|$)" },
      banned: { $ne: true },
    });

  if (existingAdmin) {
    await assignAdministration?.(
      existingAdmin._id?.toString?.() || existingAdmin.id,
    );
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

  await assignAdministration?.(result.user.id);
  log(`Better Auth administrator created: ${result.user.email}`);
  return { created: true, user: result.user };
}
