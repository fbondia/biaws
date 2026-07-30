import { COLLECTION_NAMES } from "../database/collectionNames.js";

export async function bootstrapAgent({
  auth,
  database,
  email,
  password,
  name,
  keyName = "Bondia Workspaces agent",
  assignAgent,
  log = console.log,
}) {
  const normalizedEmail = email.toLowerCase();
  let user = await database.collection(COLLECTION_NAMES.AUTH_USERS).findOne({
    email: normalizedEmail,
    banned: { $ne: true },
  });
  let created = false;

  if (!user) {
    const result = await auth.api.createUser({
      body: {
        email: normalizedEmail,
        password,
        name,
        role: "user",
      },
    });
    user = result.user;
    created = true;
    log(`Technical agent identity created: ${user.email}`);
  } else {
    log(`Technical agent identity already exists: ${user.email}`);
  }

  const userId = user._id?.toString?.() || user.id;
  await assignAgent(userId);
  const apiKey = await auth.api.createApiKey({
    body: {
      name: keyName,
      userId,
      metadata: { kind: "bootstrap-agent" },
    },
  });

  return { created, user, apiKey };
}
