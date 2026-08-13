import dns from "node:dns/promises";

import {
  isPrivateAddress,
  matchesHostPolicy,
  sanitizeEvidenceText,
  truncateText,
} from "./providerSupport.js";
import { ProviderConfigurationError } from "./providers.js";
import {
  REST_CONFIGURATION_SCHEMA,
  validateRestConfiguration,
} from "./restConfiguration.js";
import { requestRestTarget } from "./restTransport.js";

async function resolveDestination(url, policy) {
  if (!matchesHostPolicy(url.hostname, policy.allowedHosts))
    throw new ProviderConfigurationError(
      "REST_HOST_NOT_ALLOWED",
      "REST destination is outside the local host allowlist",
    );
  let addresses;
  try {
    addresses = await policy.lookup(url.hostname, {
      all: true,
      verbatim: true,
    });
  } catch {
    throw new ProviderConfigurationError(
      "REST_DNS_FAILED",
      "REST destination could not be resolved",
    );
  }
  if (
    !addresses.length ||
    (!policy.allowPrivateAddresses &&
      addresses.some(({ address }) => isPrivateAddress(address)))
  ) {
    throw new ProviderConfigurationError(
      "REST_ADDRESS_REFUSED",
      "REST destination resolved to a prohibited address",
    );
  }
  return addresses[0];
}

function templateFailure() {
  const error = new Error("REST response could not be evaluated safely");
  error.code = "TEMPLATE_EVALUATION_FAILED";
  return error;
}

function templatePayload(monitor, response, evidence, referencedValues, limit) {
  const body = truncateText(
    sanitizeEvidenceText(evidence.body, referencedValues),
    limit,
  );
  if (!monitor.templateRef) {
    return {
      provider: "rest",
      status_code: response.statusCode,
      response_body: body,
    };
  }
  const contentType = String(response.headers["content-type"] || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (
    evidence.truncated ||
    evidence.bytes > limit ||
    !/^application\/(?:[a-z0-9.+-]+\+)?json$/u.test(contentType)
  ) {
    throw templateFailure();
  }
  try {
    return JSON.parse(body);
  } catch {
    throw templateFailure();
  }
}

export function createRestProvider({
  allowedHosts = [],
  allowedMethods = ["GET", "HEAD"],
  allowPrivateAddresses = false,
  maxRedirects = 3,
  maxEvidenceBytes = 8_000,
  lookup = dns.lookup,
  request = requestRestTarget,
  resolveReference = async () => {
    throw new ProviderConfigurationError(
      "SECRET_REFERENCE_UNAVAILABLE",
      "A referenced value is not available in this executor",
    );
  },
  now = () => Date.now(),
} = {}) {
  const policy = {
    allowedHosts,
    allowedMethods: new Set(
      allowedMethods.map((method) => method.toUpperCase()),
    ),
    allowPrivateAddresses,
    maxRedirects,
    maxEvidenceBytes,
    lookup,
  };
  return {
    configurationSchema: REST_CONFIGURATION_SCHEMA,
    validateConfiguration(configuration) {
      const normalized = validateRestConfiguration(configuration);
      if (!policy.allowedMethods.has(normalized.method))
        throw new ProviderConfigurationError(
          "HTTP_METHOD_REFUSED_BY_LOCAL_POLICY",
          "HTTP method is outside the local method allowlist",
        );
      return normalized;
    },
    normalizeEvidence: (evidence) => evidence,
    async execute(monitor, { signal } = {}) {
      const configuration = monitor.configuration;
      const headers = { ...configuration.headers };
      const referencedValues = [];
      for (const { name, reference } of configuration.headerRefs) {
        const value = await resolveReference(reference, { signal });
        headers[name] = value;
        referencedValues.push(value);
      }
      let url = new URL(configuration.url);
      const startedAt = now();
      for (let redirect = 0; ; redirect += 1) {
        const destination = await resolveDestination(url, policy);
        const collectionPolicy = {
          ...policy,
          maxEvidenceBytes:
            maxEvidenceBytes +
            Math.max(0, ...referencedValues.map((value) => value.length)),
        };
        const { response, evidence } = await request(
          url,
          configuration,
          headers,
          destination,
          collectionPolicy,
          signal,
        );
        const location = response.headers.location;
        if (
          location &&
          response.statusCode >= 300 &&
          response.statusCode < 400
        ) {
          if (!configuration.followRedirects || redirect >= maxRedirects)
            throw new ProviderConfigurationError(
              "REST_REDIRECT_REFUSED",
              "REST redirect was refused by local policy",
            );
          if (!["GET", "HEAD"].includes(configuration.method))
            throw new ProviderConfigurationError(
              "REST_REDIRECT_REFUSED",
              "Redirects for requests with side effects are refused",
            );
          const redirectUrl = new URL(location, url);
          if (redirectUrl.origin !== url.origin)
            throw new ProviderConfigurationError(
              "REST_REDIRECT_REFUSED",
              "Cross-origin REST redirects are refused",
            );
          url = redirectUrl;
          if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password
          )
            throw new ProviderConfigurationError(
              "REST_REDIRECT_REFUSED",
              "REST redirect target is not allowed",
            );
          continue;
        }
        const expected = configuration.expectedStatuses.length
          ? configuration.expectedStatuses.includes(response.statusCode)
          : response.statusCode >= 200 && response.statusCode < 300;
        return {
          status: expected ? "healthy" : "unavailable",
          message: expected
            ? "REST target responded successfully"
            : "REST target returned an unexpected status",
          metadata: {
            outcome_kind: expected ? "target_healthy" : "target_unhealthy",
            http_status: response.statusCode,
            duration_ms: Math.max(0, now() - startedAt),
            response_bytes: evidence.bytes,
            evidence_truncated: evidence.bytes > maxEvidenceBytes,
          },
          payload: templatePayload(
            monitor,
            response,
            evidence,
            referencedValues,
            maxEvidenceBytes,
          ),
        };
      }
    },
  };
}
