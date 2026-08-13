import {
  assertAllowedKeys,
  assertObject,
  boundedString,
} from "./providerSupport.js";
import { ProviderConfigurationError } from "./providers.js";

const ALLOWED_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
const SENSITIVE_HEADER =
  /^(authorization|cookie|proxy-authorization|x-api-key)$/iu;
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;

export const REST_CONFIGURATION_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["url"],
  properties: {
    method: { enum: [...ALLOWED_METHODS] },
    url: { type: "string", maxLength: 2_048 },
    headers: { type: "object", additionalProperties: { type: "string" } },
    headerRefs: {
      type: "array",
      maxItems: 32,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "reference"],
        properties: {
          name: { type: "string", maxLength: 100 },
          reference: { type: "string", maxLength: 160 },
        },
      },
    },
    body: { type: "string", maxLength: 65_536 },
    followRedirects: { type: "boolean" },
    expectedStatuses: {
      type: "array",
      items: { type: "integer", minimum: 100, maximum: 599 },
    },
  },
});

function validateHeaderReferences(value, field) {
  if (!Array.isArray(value) || value.length > 32)
    throw new ProviderConfigurationError(
      "INVALID_HEADER_REFERENCES",
      `${field} must contain at most 32 entries`,
    );
  return value.map((raw, index) => {
    assertObject(raw, `${field}[${index}]`);
    assertAllowedKeys(raw, ["name", "reference"], `${field}[${index}]`);
    const name = boundedString(raw.name, `${field}[${index}].name`, {
      required: true,
      max: 100,
    });
    if (!HEADER_NAME.test(name))
      throw new ProviderConfigurationError(
        "INVALID_HEADER_NAME",
        `${field} contains an invalid header name`,
      );
    return {
      name,
      reference: boundedString(raw.reference, `${field}[${index}].reference`, {
        required: true,
        max: 160,
      }),
    };
  });
}

function validateHeaders(value, field, { references = false } = {}) {
  if (value === undefined) return references ? [] : {};
  if (references) return validateHeaderReferences(value, field);
  assertObject(value, field);
  const entries = Object.entries(value);
  if (entries.length > 32)
    throw new ProviderConfigurationError(
      "TOO_MANY_HEADERS",
      `${field} has too many entries`,
    );
  return Object.fromEntries(
    entries.map(([name, entry]) => {
      if (!HEADER_NAME.test(name) || name.length > 100)
        throw new ProviderConfigurationError(
          "INVALID_HEADER_NAME",
          `${field} contains an invalid header name`,
        );
      if (SENSITIVE_HEADER.test(name))
        throw new ProviderConfigurationError(
          "INLINE_SECRET_HEADER_REFUSED",
          `${field} contains a sensitive header that must use headerRefs`,
        );
      return [
        name,
        boundedString(entry, `${field}.${name}`, {
          required: true,
          max: 4_000,
        }),
      ];
    }),
  );
}

function validateStatuses(value) {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 100 ||
    value.some(
      (entry) => !Number.isInteger(entry) || entry < 100 || entry > 599,
    )
  )
    throw new ProviderConfigurationError(
      "INVALID_EXPECTED_STATUSES",
      "expectedStatuses must contain valid HTTP status codes",
    );
  return [...new Set(value)];
}

export function validateRestConfiguration(configuration) {
  assertObject(configuration, "configuration");
  assertAllowedKeys(configuration, [
    "method",
    "url",
    "headers",
    "headerRefs",
    "body",
    "followRedirects",
    "expectedStatuses",
  ]);
  const method = boundedString(configuration.method || "GET", "method", {
    required: true,
    max: 10,
  }).toUpperCase();
  if (!ALLOWED_METHODS.has(method))
    throw new ProviderConfigurationError(
      "HTTP_METHOD_REFUSED",
      "HTTP method is not allowed",
    );
  const rawUrl = boundedString(configuration.url, "url", {
    required: true,
    max: 2_048,
  });
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ProviderConfigurationError(
      "INVALID_REST_URL",
      "url must be an absolute HTTP(S) URL",
    );
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new ProviderConfigurationError(
      "REST_URL_REFUSED",
      "url protocol or embedded credentials are not allowed",
    );
  const body = boundedString(configuration.body, "body", { max: 65_536 });
  if (["GET", "HEAD"].includes(method) && body)
    throw new ProviderConfigurationError(
      "HTTP_BODY_REFUSED",
      `${method} requests cannot contain a body`,
    );
  if (
    configuration.followRedirects !== undefined &&
    typeof configuration.followRedirects !== "boolean"
  )
    throw new ProviderConfigurationError(
      "INVALID_REDIRECT_POLICY",
      "followRedirects must be a boolean",
    );
  return {
    method,
    url: url.toString(),
    headers: validateHeaders(configuration.headers, "headers"),
    headerRefs: validateHeaders(configuration.headerRefs, "headerRefs", {
      references: true,
    }),
    body,
    followRedirects: configuration.followRedirects === true,
    expectedStatuses: validateStatuses(configuration.expectedStatuses),
  };
}
