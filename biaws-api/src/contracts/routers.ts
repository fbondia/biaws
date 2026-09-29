import { accessRouter } from "../routes/access/index.js";
import { auditRouter } from "../routes/audit/index.js";
import { catalogRouter } from "../routes/catalog/index.js";
import { catalogTopologyRouter } from "../routes/catalogTopology/index.js";
import { homeRouter } from "../routes/home/index.js";
import { identityRouter } from "../routes/identity/index.js";
import { issuesRouter } from "../routes/issues/index.js";
import { knowledgeRecordsRouter } from "../routes/knowledgeRecords/index.js";
import { monitoringRouter } from "../routes/monitoring/index.js";
import { optionListsRouter } from "../routes/optionLists/index.js";
import { platformRouter } from "../routes/platform/index.js";
import { requestsRouter } from "../routes/requests/index.js";
import { resourceCollectionsRouter } from "../routes/resourceCollections/index.js";
import { secretsRouter } from "../routes/secrets/index.js";
import { skillsRouter } from "../routes/skills/index.js";
import { userPreferencesRouter } from "../routes/userPreferences/index.js";
import type { ContractRouter } from "./routeContracts.js";

export const contractRouters: readonly ContractRouter[] = [
  { domain: "accessRouter", prefix: "/api/access", router: accessRouter },
  { domain: "auditRouter", prefix: "/api/audit", router: auditRouter },
  { domain: "catalogRouter", prefix: "/api/catalog", router: catalogRouter },
  {
    domain: "catalogTopologyRouter",
    prefix: "/api/catalog",
    router: catalogTopologyRouter,
  },
  { domain: "homeRouter", prefix: "/api/home", router: homeRouter },
  { domain: "identityRouter", prefix: "/api/identity", router: identityRouter },
  { domain: "issuesRouter", prefix: "/api/issues", router: issuesRouter },
  {
    domain: "knowledgeRecordsRouter",
    prefix: "/api/knowledge",
    router: knowledgeRecordsRouter,
  },
  {
    domain: "monitoringRouter",
    prefix: "/api/monitoring",
    router: monitoringRouter,
  },
  {
    domain: "optionListsRouter",
    prefix: "/api/option-lists",
    router: optionListsRouter,
  },
  { domain: "platformRouter", prefix: "/api/platform", router: platformRouter },
  { domain: "requestsRouter", prefix: "/api/requests", router: requestsRouter },
  {
    domain: "resourceCollectionsRouter",
    prefix: "/api/resource-collections",
    router: resourceCollectionsRouter,
  },
  { domain: "secretsRouter", prefix: "/api/secrets", router: secretsRouter },
  { domain: "skillsRouter", prefix: "/api/skills", router: skillsRouter },
  {
    domain: "userPreferencesRouter",
    prefix: "/api/preferences",
    router: userPreferencesRouter,
  },
];
