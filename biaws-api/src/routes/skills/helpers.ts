import { textValue } from "../../helpers/text.js";
import type { Response } from "express";
import { ParsedQs } from "qs";
export function sendNotFound(
  res: Response,
  skillId: string | string[],
  version?: string | ParsedQs | (string | ParsedQs)[],
) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Skill not found: ${skillId}${version ? "@" + textValue(version) : ""}`,
    },
  });
}
