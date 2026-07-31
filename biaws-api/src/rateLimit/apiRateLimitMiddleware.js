import { consumeApiRateLimit } from "./apiRateLimitRepository.js";

function actorRateLimitKey(actor) {
  if (actor.authenticationMethod === "api-key" && actor.apiKeyId) {
    return `api-key:${actor.apiKeyId}`;
  }
  return `user:${actor.userId}`;
}

export function createApiRateLimitMiddleware(
  config,
  { consume = consumeApiRateLimit } = {},
) {
  return async function apiRateLimitMiddleware(req, res, next) {
    if (!config.enabled) {
      next();
      return;
    }

    try {
      const result = await consume({
        key: actorRateLimitKey(req.actor),
        windowSeconds: config.windowSeconds,
      });
      const remaining = Math.max(config.maxRequests - result.count, 0);
      const retryAfter = Math.max(
        Math.ceil((result.expiresAt.getTime() - Date.now()) / 1_000),
        1,
      );

      res.set("RateLimit-Limit", String(config.maxRequests));
      res.set("RateLimit-Remaining", String(remaining));
      res.set("RateLimit-Reset", String(retryAfter));

      if (result.count > config.maxRequests) {
        res.set("Retry-After", String(retryAfter));
        res.status(429).json({
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests. Please try again later.",
          },
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
