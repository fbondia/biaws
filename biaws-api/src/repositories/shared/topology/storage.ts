import type {
  ComponentDocument,
  RepositoryDocument,
  ServerDocument,
  DeploymentDocument,
  RuntimeDocument,
} from "../../../types/topology.js";
import {
  COMPONENTS_COLLECTION,
  REPOSITORIES_COLLECTION,
  SERVERS_COLLECTION,
  DEPLOYMENTS_COLLECTION,
  RUNTIMES_COLLECTION,
} from "./constants.js";
import { getMongoDatabase } from "../../../helpers/mongoClient.js";

let collectionsPromise: ReturnType<typeof initializeCollections> | undefined;

export async function getTopologyCollections() {
  collectionsPromise ??= initializeCollections().catch((error: unknown) => {
    collectionsPromise = undefined;
    throw error;
  });
  return collectionsPromise;
}

async function initializeCollections() {
  const db = await getMongoDatabase();
  const components = db.collection<ComponentDocument>(COMPONENTS_COLLECTION);
  const repositories = db.collection<RepositoryDocument>(REPOSITORIES_COLLECTION);
  const servers = db.collection<ServerDocument>(SERVERS_COLLECTION);
  const deployments = db.collection<DeploymentDocument>(DEPLOYMENTS_COLLECTION);
  const runtimes = db.collection<RuntimeDocument>(RUNTIMES_COLLECTION);
  await Promise.all([
    components.createIndex({ id: 1 }, { unique: true }),
    components.createIndex({ workspaceId: 1, applicationId: 1, key: 1 }, { unique: true }),
    components.createIndex({
      workspaceId: 1,
      applicationId: 1,
      status: 1,
      name: 1,
      id: 1,
    }),
    components.createIndex({
      workspaceId: 1,
      applicationId: 1,
      name: 1,
      id: 1,
    }),
    components.createIndex({
      workspaceId: 1,
      applicationId: 1,
      "repositoryLinks.repositoryId": 1,
    }),
    components.createIndex({
      workspaceId: 1,
      applicationId: 1,
      "dependencies.componentId": 1,
    }),
    repositories.createIndex({ id: 1 }, { unique: true }),
    repositories.createIndex({ workspaceId: 1, applicationId: 1, key: 1 }, { unique: true }),
    repositories.createIndex({
      workspaceId: 1,
      applicationId: 1,
      status: 1,
      name: 1,
      id: 1,
    }),
    repositories.createIndex({
      workspaceId: 1,
      applicationId: 1,
      name: 1,
      id: 1,
    }),
    servers.createIndex({ id: 1 }, { unique: true }),
    servers.createIndex({ workspaceId: 1, key: 1 }, { unique: true }),
    servers.createIndex({ workspaceId: 1, status: 1, name: 1, id: 1 }),
    servers.createIndex({ workspaceId: 1, name: 1, id: 1 }),
    servers.createIndex({
      workspaceId: 1,
      collectionId: 1,
      status: 1,
      name: 1,
      id: 1,
    }),
    deployments.createIndex({ id: 1 }, { unique: true }),
    deployments.createIndex({ workspaceId: 1, applicationId: 1, key: 1 }, { unique: true }),
    deployments.createIndex({
      workspaceId: 1,
      applicationId: 1,
      componentId: 1,
      status: 1,
      deployedAt: -1,
      id: 1,
    }),
    deployments.createIndex({
      workspaceId: 1,
      applicationId: 1,
      "source.repositoryId": 1,
    }),
    deployments.createIndex({
      workspaceId: 1,
      applicationId: 1,
      deployedAt: -1,
      id: 1,
    }),
    runtimes.createIndex({ id: 1 }, { unique: true }),
    runtimes.createIndex({ workspaceId: 1, applicationId: 1, deploymentId: 1, key: 1 }, { unique: true }),
    runtimes.createIndex({
      workspaceId: 1,
      applicationId: 1,
      deploymentId: 1,
      status: 1,
      name: 1,
      id: 1,
    }),
    runtimes.createIndex({ workspaceId: 1, serverId: 1, status: 1 }),
    runtimes.createIndex({
      workspaceId: 1,
      applicationId: 1,
      name: 1,
      id: 1,
    }),
  ]);
  return { db, components, repositories, servers, deployments, runtimes };
}
