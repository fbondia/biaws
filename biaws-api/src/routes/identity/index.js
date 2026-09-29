import { Router } from "express";
import { registerListUsers } from "./listUsers.js";
import { registerCreateUser } from "./createUser.js";
import { registerUpdateUsersDisabled } from "./users/updateUsersDisabled.js";
import { registerReplaceUsersPassword } from "./users/replaceUsersPassword.js";
import { registerDeleteUsersSessions } from "./users/deleteUsersSessions.js";

export const identityRouter = Router();
registerListUsers(identityRouter);
registerCreateUser(identityRouter);
registerUpdateUsersDisabled(identityRouter);
registerReplaceUsersPassword(identityRouter);
registerDeleteUsersSessions(identityRouter);
