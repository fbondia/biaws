import type { ServerFields } from "../../types/topology.js";
import { MUTABLE_SERVER_STATUSES } from "./constants.js";
import { CATALOG_LIMITS } from "../../../../shared/index.js";
import {
  assertAllowedFields,
  assertCredentialFreeUrl,
  normalizeEnum,
  normalizeKey,
  normalizeStringArray,
  normalizeTags,
  optionalText,
  requiredText,
} from "../shared/topology/normalization.js";
import { createCatalogError } from "../shared/topology/errors.js";

function normalizeAddresses(value: unknown, current: string[] = []) {
  const addresses = normalizeStringArray(value, "addresses", {
    limit: CATALOG_LIMITS.addresses,
    itemLimit: CATALOG_LIMITS.address,
    current,
  });
  for (const [index, address] of addresses.entries()) {
    if (/[\u0000-\u001f\u007f]/u.test(address)) {
      throw createCatalogError(422, "INVALID_SERVER_ADDRESS", `addresses[${index}] contains control characters`);
    }
    if (address.includes("://")) {
      let url;
      try {
        url = new URL(address);
      } catch {
        throw createCatalogError(422, "INVALID_SERVER_ADDRESS", `addresses[${index}] must be a valid address`);
      }
      assertCredentialFreeUrl(url, `addresses[${index}]`);
    }
  }
  return addresses;
}

export function normalizeServerInput(
  payload: Record<string, unknown> = {},
  current: Partial<ServerFields> | null = null,
) {
  assertAllowedFields(
    payload,
    [
      "key",
      "name",
      "description",
      "hostname",
      "addresses",
      "provider",
      "location",
      "operatingSystem",
      "purpose",
      "status",
      "tags",
    ],
    "server",
  );
  return {
    key: normalizeKey(payload.key, current?.key),
    name: requiredText(payload.name ?? current?.name, "name", CATALOG_LIMITS.name),
    description: optionalText(payload.description ?? current?.description, "description", CATALOG_LIMITS.description),
    hostname: optionalText(payload.hostname ?? current?.hostname, "hostname", CATALOG_LIMITS.hostname),
    addresses: normalizeAddresses(payload.addresses, current?.addresses),
    provider: optionalText(payload.provider ?? current?.provider, "provider", CATALOG_LIMITS.provider),
    location: optionalText(payload.location ?? current?.location, "location", CATALOG_LIMITS.location),
    operatingSystem: optionalText(
      payload.operatingSystem ?? current?.operatingSystem,
      "operatingSystem",
      CATALOG_LIMITS.operatingSystem,
    ),
    purpose: optionalText(payload.purpose ?? current?.purpose, "purpose", CATALOG_LIMITS.purpose),
    status: normalizeEnum(payload.status, "status", MUTABLE_SERVER_STATUSES, current?.status || "active"),
    tags: normalizeTags(payload.tags, current?.tags),
  };
}
