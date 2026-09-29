import { Router } from "express";
import { registerListSkills } from "./listSkills.js";
import { registerUpdateCollection } from "./collection/updateCollection.js";
import { registerCreateSkill } from "./createSkill.js";
import { registerGetSkill } from "./getSkill.js";
import { registerListDownload } from "./download/listDownload.js";
import { registerCreateReplicate } from "./replicate/createReplicate.js";
import { registerUpdateDeprecate } from "./deprecate/updateDeprecate.js";

export const skillsRouter = Router();
registerListSkills(skillsRouter);
registerUpdateCollection(skillsRouter);
registerCreateSkill(skillsRouter);
registerGetSkill(skillsRouter);
registerListDownload(skillsRouter);
registerCreateReplicate(skillsRouter);
registerUpdateDeprecate(skillsRouter);
