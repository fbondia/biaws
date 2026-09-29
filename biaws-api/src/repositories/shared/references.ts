import { errorCode } from "../../helpers/error.js";
import type { RepositoryQuery } from "../../types/http.js";
import { ObjectId } from "mongodb";
import { COLLECTION_NAMES as C } from "../../database/collectionNames.js";
import { getMongoDatabase } from "../../helpers/mongoClient.js";
import {
  findByReference,
  referenceError,
} from "../../helpers/referenceLookup.js";
import { buildKnowledgeContextFilter } from "./knowledgeContext.js";
import { ObjectIdLike } from "bson";

const ENTITIES: Record<
  string,
  readonly [
    collection: string,
    idField: string,
    identifierField: string,
    lowercase?: boolean,
  ]
> = {
  issue: [C.ISSUES, "id", "identifier"],
  demand: [C.REQUESTS, "_id", "clientCode"],
  task: [C.REQUEST_TASKS, "_id", "code"],
  document: [C.DOCUMENTS, "id", "identifier", true],
  application: [C.APPLICATIONS, "id", "key", true],
  component: [C.APPLICATION_COMPONENTS, "id", "key", true],
  integration: [C.APPLICATION_INTEGRATIONS, "id", "key", true],
  repository: [C.APPLICATION_REPOSITORIES, "id", "key", true],
  server: [C.SERVERS, "id", "key", true],
  deployment: [C.APPLICATION_DEPLOYMENTS, "id", "key", true],
  runtime: [C.DEPLOYMENT_RUNTIMES, "id", "key", true],
  secret: [C.SECRETS, "id", "identifier", true],
  workspace: [C.WORKSPACES, "id", "key", true],
};

export async function resolveEntityReference(
  type: string,
  reference: unknown,
  query: RepositoryQuery = {},
  additions = {},
) {
  const config = ENTITIES[type];
  if (!config)
    throw referenceError(404, "NOT_FOUND", "Unsupported entity reference");
  const [collectionName, idField, identifierField, lowercase] = config;
  const db = await getMongoDatabase({ db: query.db, database: query.database });
  const context = buildKnowledgeContextFilter(query);
  if (type === "workspace") {
    delete context.workspaceId;
    delete context.applicationId;
    const workspaceId =
      query.authorizationScope?.workspaceId || query.workspaceId;
    if (workspaceId) context.id = workspaceId;
  }
  if (type === "application" && context.applicationId) {
    context.id = context.applicationId;
    delete context.applicationId;
  }
  // Tasks inherit tenancy from their already-authorized demand.
  const filter = type === "task" ? additions : { ...context, ...additions };
  const document = await findByReference(
    db.collection(collectionName),
    reference,
    {
      filter,
      idField,
      identifierField,
      lowercase,
      caseInsensitive: type === "task",
      projection: {
        _id: 1,
        id: 1,
        workspaceId: 1,
        applicationId: 1,
        deploymentId: 1,
        requestId: 1,
      },
    },
  );
  if (!document)
    throw referenceError(
      404,
      "NOT_FOUND",
      "Item not found in the authorized scope",
    );
  return String(document[idField]);
}

export async function resolveTaskReference(
  reference: string | string[],
  demandId: string | string[],
  query: RepositoryQuery = {},
) {
  return resolveEntityReference("task", reference, query, {
    requestId: new ObjectId(String(demandId)),
  });
}

export async function resolveAuditReference(
  type: string,
  reference: string,
  query: RepositoryQuery = {},
) {
  if (!ENTITIES[type]) return reference;
  try {
    if (type !== "task")
      return await resolveEntityReference(type, reference, query);
    if (query.demandId) {
      const demandId = await resolveEntityReference(
        "demand",
        query.demandId,
        query,
      );
      return await resolveTaskReference(reference, demandId, query);
    }
    const db = await getMongoDatabase({
      db: query.db,
      database: query.database,
    });
    const lookup = async (match: { _id?: ObjectId; code?: string }) =>
      db
        .collection(C.REQUEST_TASKS)
        .aggregate([
          { $match: match },
          {
            $lookup: {
              from: C.REQUESTS,
              localField: "requestId",
              foreignField: "_id",
              pipeline: [{ $match: buildKnowledgeContextFilter(query) }],
              as: "parent",
            },
          },
          { $match: { "parent.0": { $exists: true } } },
          { $project: { _id: 1 } },
          { $limit: 2 },
        ])
        .toArray();
    if (ObjectId.isValid(reference)) {
      const direct = await lookup({ _id: new ObjectId(reference) });
      if (direct.length) return String(direct[0]._id);
    }
    const matches = await lookup({ code: String(reference) });
    if (matches.length > 1)
      throw referenceError(
        409,
        "AMBIGUOUS_REFERENCE",
        "The task identifier is ambiguous; use its ID or demandId",
      );
    return matches.length ? String(matches[0]._id) : reference;
  } catch (error) {
    // Audit history must remain readable after the entity has been deleted.
    if (error instanceof Error && error.statusCode === 404) return reference;
    throw error;
  }
}
