import { Router } from "express";
import { registerGetResourceCollection } from "./getResourceCollection.js";
import { registerCreateResourceCollection } from "./createResourceCollection.js";
import { registerUpdateResourceCollection } from "./updateResourceCollection.js";
import { registerDeleteResourceCollection } from "./deleteResourceCollection.js";

export const resourceCollectionsRouter = Router();
registerGetResourceCollection(resourceCollectionsRouter);
registerCreateResourceCollection(resourceCollectionsRouter);
registerUpdateResourceCollection(resourceCollectionsRouter);
registerDeleteResourceCollection(resourceCollectionsRouter);
