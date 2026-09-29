import { ObjectId } from "mongodb";

export function referenceError(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
}

// Separate queries guarantee that an ID wins even if another record uses it
// as its business identifier. Both queries retain exactly the same scope.
export async function findByReference(
  collection,
  reference,
  {
    filter = {},
    idField = "id",
    identifierField,
    lowercase = false,
    caseInsensitive = false,
    projection,
  } = {},
) {
  const value = String(reference || "").trim();
  if (!value || value.length > 240) {
    throw referenceError(
      422,
      "INVALID_REFERENCE",
      "A non-empty reference of at most 240 characters is required",
    );
  }
  const id =
    idField === "_id"
      ? ObjectId.isValid(value)
        ? new ObjectId(value)
        : null
      : value;
  const options = projection ? { projection } : {};
  if (id !== null) {
    const document = await collection.findOne(
      { $and: [filter, { [idField]: id }] },
      options,
    );
    if (document) return document;
  }
  if (!identifierField) return null;
  const documents = await collection
    .find(
      {
        $and: [
          filter,
          { [identifierField]: lowercase ? value.toLowerCase() : value },
        ],
      },
      {
        ...options,
        ...(caseInsensitive
          ? { collation: { locale: "en", strength: 2 } }
          : {}),
      },
    )
    .limit(2)
    .toArray();
  if (documents.length > 1) {
    throw referenceError(
      409,
      "AMBIGUOUS_REFERENCE",
      "The identifier matches more than one accessible item; use its ID",
    );
  }
  return documents[0] || null;
}
