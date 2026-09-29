import {
  normalizeKey,
  requiredText,
  createHttpError,
  optionalText,
} from "../support.js";
import { CATALOG_LIMITS } from "../../../../../shared/index.js";
import { COLLECTION_NAMES } from "../../../database/collectionNames.js";

function normalizeTags(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      "tags must be an array",
    );
  }
  if (value.length > CATALOG_LIMITS.tags) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `tags must contain at most ${CATALOG_LIMITS.tags} items`,
    );
  }
  const tags = value.map((tag, index) =>
    requiredText(tag, `tags[${index}]`, CATALOG_LIMITS.tag),
  );
  const unique = new Map();
  for (const tag of tags) {
    const normalizedKey = tag.toLocaleLowerCase("pt-BR");
    if (!unique.has(normalizedKey)) unique.set(normalizedKey, tag);
  }
  return [...unique.values()];
}

function normalizeLinks(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      "links must be an array",
    );
  }
  if (value.length > CATALOG_LIMITS.links) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `links must contain at most ${CATALOG_LIMITS.links} items`,
    );
  }
  return value.map((link, index) => {
    const label = requiredText(
      link?.label,
      `links[${index}].label`,
      CATALOG_LIMITS.linkLabel,
    );
    const rawUrl = requiredText(
      link?.url,
      `links[${index}].url`,
      CATALOG_LIMITS.linkUrl,
    );
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      throw createHttpError(
        422,
        "INVALID_CATALOG_URL",
        `links[${index}].url must be a valid URL`,
      );
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      throw createHttpError(
        422,
        "INVALID_CATALOG_URL",
        `links[${index}].url must use HTTP(S) without embedded credentials`,
      );
    }
    return { label, url: url.toString() };
  });
}

function normalizeOwner(value, current = {}) {
  if (value === undefined) return current;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      "owner must be an object",
    );
  }
  return {
    team: optionalText(value.team, "owner.team", CATALOG_LIMITS.ownerTeam),
    contact: optionalText(
      value.contact,
      "owner.contact",
      CATALOG_LIMITS.ownerContact,
    ),
  };
}

export function normalizeApplicationInput(payload = {}, current = null) {
  const allowedFields = new Set([
    "key",
    "name",
    "description",
    "owner",
    "tags",
    "links",
  ]);
  const unknownFields = Object.keys(payload).filter(
    (field) => !allowedFields.has(field),
  );
  if (unknownFields.length) {
    throw createHttpError(
      422,
      "INVALID_CATALOG_PAYLOAD",
      `unknown application fields: ${unknownFields.join(", ")}`,
    );
  }
  const key = normalizeKey(payload.key ?? current?.key);

  return {
    key,
    name: requiredText(
      payload.name ?? current?.name,
      "name",
      CATALOG_LIMITS.name,
    ),
    description: optionalText(
      payload.description ?? current?.description,
      "description",
      CATALOG_LIMITS.description,
    ),
    owner: normalizeOwner(payload.owner, current?.owner),
    tags: normalizeTags(payload.tags) ?? current?.tags ?? [],
    links: normalizeLinks(payload.links) ?? current?.links ?? [],
  };
}

export function applicationDeletionDependencies(application) {
  const scope = {
    workspaceId: application.workspaceId,
    applicationId: application.id,
  };
  return [
    ["componentes", COLLECTION_NAMES.APPLICATION_COMPONENTS, scope],
    [
      "integrações",
      COLLECTION_NAMES.APPLICATION_INTEGRATIONS,
      {
        workspaceId: application.workspaceId,
        $or: [
          { applicationId: application.id },
          { targetApplicationId: application.id },
        ],
      },
    ],
    ["repositórios", COLLECTION_NAMES.APPLICATION_REPOSITORIES, scope],
    ["deployments", COLLECTION_NAMES.APPLICATION_DEPLOYMENTS, scope],
    ["runtimes", COLLECTION_NAMES.DEPLOYMENT_RUNTIMES, scope],
    ["documentos", COLLECTION_NAMES.DOCUMENTS, scope],
    ["issues", COLLECTION_NAMES.ISSUES, scope],
    ["demandas", COLLECTION_NAMES.REQUESTS, scope],
    ["segredos", COLLECTION_NAMES.SECRETS, scope],
  ];
}
