export function sendNotFound(res, skillId, version) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Skill not found: ${skillId}${version ? `@${version}` : ""}`,
    },
  });
}
