import { COLLECTION_NAMES } from "../../../database/collectionNames.js";

export const COMPONENTS_COLLECTION = COLLECTION_NAMES.APPLICATION_COMPONENTS;

export const REPOSITORIES_COLLECTION =
  COLLECTION_NAMES.APPLICATION_REPOSITORIES;

export const SERVERS_COLLECTION = COLLECTION_NAMES.SERVERS;

export const DEPLOYMENTS_COLLECTION = COLLECTION_NAMES.APPLICATION_DEPLOYMENTS;

export const RUNTIMES_COLLECTION = COLLECTION_NAMES.DEPLOYMENT_RUNTIMES;

export const PROHIBITED_METADATA_KEY =
  /(?:password|passwd|pwd|secret|token|credential|authorization|api[-_.]?key|private[-_.]?key|kubeconfig|connection[-_.]?string)/iu;
