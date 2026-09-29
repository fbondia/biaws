import type { ObjectId } from "mongodb";
import type {
  Specification,
  SpecificationSection,
} from "../../types/requests.js";
import { isRecord } from "../../helpers/records.js";
import type { Db } from "mongodb";
import { requestOptions } from "./options.js";
import { readString, readNumber } from "./support.js";
import { SPECIFICATION_COLLECTION } from "./constants.js";

function defaultSpecificationSections() {
  return requestOptions.defaultSpecificationSectionTitles.map(
    (title, index: number) => ({
      id: `default-${index + 1}`,
      title,
      content: "",
      order: index,
    }),
  );
}

export function normalizeSpecification(
  payloadSpecification: unknown,
): Specification {
  const payloadSections = Array.isArray(payloadSpecification)
    ? payloadSpecification
    : isRecord(payloadSpecification) &&
        Array.isArray(payloadSpecification.sections)
      ? payloadSpecification.sections
      : null;

  if (!payloadSections) {
    return {
      sections: defaultSpecificationSections(),
    };
  }

  return {
    sections: payloadSections
      .map((section, index: number) => ({
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
      .sort(
        (first: { order: number }, second: { order: number }) =>
          first.order - second.order,
      ),
  };
}

export async function readSpecifications(db: Db, requestIds: ObjectId[]) {
  if (!requestIds.length) return new Map<string, Specification>();

  const rows = await db
    .collection(SPECIFICATION_COLLECTION)
    .find({ requestId: { $in: requestIds } })
    .toArray();
  const byRequestId = new Map<string, Specification>();

  for (const row of rows) {
    const key = row.requestId?.toString?.() ?? String(row.requestId);
    byRequestId.set(key, {
      sections: row.sections || [],
    });
  }

  return byRequestId;
}

export async function syncSpecification(
  db: Db,
  requestId: ObjectId,
  specification: Specification,
  now: Date,
) {
  await db.collection(SPECIFICATION_COLLECTION).updateOne(
    { requestId },
    {
      $set: {
        requestId,
        sections: specification.sections.map((section, index: number) => ({
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
