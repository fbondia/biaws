import { Router } from "express";
import { registerListRuntime } from "./listRuntime.js";
import { registerListOptionLists } from "./listOptionLists.js";
import { registerReplaceOptionList } from "./replaceOptionList.js";
import { registerCreateReplicate } from "./replicate/createReplicate.js";

export const optionListsRouter = Router();
registerListRuntime(optionListsRouter);
registerListOptionLists(optionListsRouter);
registerReplaceOptionList(optionListsRouter);
registerCreateReplicate(optionListsRouter);
