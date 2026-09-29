import { defaultSpecificationSectionTitles } from "./options.js";
import { readString, readNumber } from "./support.js";
import { SPECIFICATION_COLLECTION } from "./constants.js";

function defaultSpecificationSections() {
  return defaultSpecificationSectionTitles.map((title, index) => ({
    id: `default-${index + 1}`,
    title,
    content: "",
    order: index,
  }));
}

export function normalizeSpecification(payloadSpecification) {
  const payloadSections = Array.isArray(payloadSpecification)
    ? payloadSpecification
    : Array.isArray(payloadSpecification?.sections)
      ? payloadSpecification.sections
      : null;

  if (!payloadSections) {
    return {
      sections: defaultSpecificationSections(),
    };
  }

  return {
    sections: payloadSections
      .map((section, index) => ({
        id:
          readString(section?.id, `section-${index + 1}`).trim() ||
          `section-${index + 1}`,
        title: readString(section?.title, "Nova seção").trim() || "Nova seção",
        content: readString(section?.content),
        order: readNumber(
          section?.order ?? index,
          `specification.sections[${index}].order`,
        ),
      }))
      .sort((first, second) => first.order - second.order),
  };
}

export async function readSpecifications(db, requestIds) {
  if (!requestIds.length) return new Map();

  const rows = await db
    .collection(SPECIFICATION_COLLECTION)
    .find({ requestId: { $in: requestIds } })
    .toArray();
  const byRequestId = new Map();

  for (const row of rows) {
    const key = row.requestId?.toString?.() ?? String(row.requestId);
    byRequestId.set(key, {
      sections: row.sections || [],
    });
  }

  return byRequestId;
}

export async function syncSpecification(db, requestId, specification, now) {
  await db.collection(SPECIFICATION_COLLECTION).updateOne(
    { requestId },
    {
      $set: {
        requestId,
        sections: specification.sections.map((section, index) => ({
          id: section.id,
          title: section.title,
          content: section.content,
          order: index,
        })),
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
}
