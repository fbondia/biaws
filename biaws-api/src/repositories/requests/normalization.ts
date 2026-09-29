import type {
  ChecklistInput,
  RequestDocument,
  NoteDocument,
  TaskDocument,
} from "../../types/requests.js";
import {
  checklistLabels,
  allRequestStatusOptions,
  defaultRequestStatus,
} from "./options.js";
import {
  readString,
  assertDate,
  normalizeStatus,
  readNumber,
} from "./support.js";
import { normalizeJourneyPeriods } from "./journeys.js";
import { normalizeSpecification } from "./specification.js";
import { normalizeNoteDocument } from "./notes/normalization.js";
import { normalizeTaskDocument } from "./tasks/normalization.js";
import { requestListRank } from "./ordering.js";
import { normalizeStoredKnowledgeContext } from "../shared/knowledgeContext.js";

export function normalizeChecklist(items: unknown) {
  const sourceItems: ChecklistInput[] = Array.isArray(items)
    ? items
    : checklistLabels.map((label: string) => ({ label }));
  const byLabel = new Map(sourceItems.map((item) => [item?.label, item]));
  const labels = sourceItems
    .map((item) => String(item?.label || "").trim())
    .filter((label: string, index: number, values) =>
      Boolean(label && values.indexOf(label) === index),
    );

  return labels.map((label: string) => {
    const item = byLabel.get(label) || {};
    const date = readString(item.date);

    assertDate(date, `checklist.${label}.date`);

    return {
      label,
      done: Boolean(item.done),
      date,
      comment: readString(item.comment),
    };
  });
}

export function normalizeRequestPayload(
  payload: Record<string, unknown> = {},
  allowedHistoricalStatus = "",
) {
  const title = readString(payload.title).trim();
  const estimatedDeliveryDate = readString(payload.estimatedDeliveryDate);
  const startDate = readString(payload.startDate);
  const endDate = readString(payload.endDate);

  assertDate(estimatedDeliveryDate, "estimatedDeliveryDate");
  assertDate(startDate, "startDate");
  assertDate(endDate, "endDate");

  return {
    request: {
      clientCode: readString(payload.clientCode).trim(),
      title,
      status: normalizeStatus(payload.status, allowedHistoricalStatus),
      estimatedDeliveryDate,
      startDate,
      endDate,
      estimatedJourneys: readNumber(
        payload.estimatedJourneys,
        "estimatedJourneys",
      ),
      description: readString(payload.description),
      collectionId: readString(payload.collectionId).trim(),
      checklist: normalizeChecklist(payload.checklist),
    },
    journeys: normalizeJourneyPeriods(
      payload.journeys ?? payload.billing,
      startDate,
      endDate,
    ),
    specification: normalizeSpecification(payload.specification),
  };
}

function normalizeRequestDocumentValue(
  document: RequestDocument | null | undefined,
  journeys: unknown = [],
  specification: unknown = null,
  notes: NoteDocument[] = [],
  tasks: TaskDocument[] = [],
) {
  if (!document) return null;
  const context = normalizeStoredKnowledgeContext(document);

  return {
    id: document._id?.toString?.() ?? String(document._id),
    clientCode: document.clientCode || "",
    title: document.title || "",
    status: allRequestStatusOptions.includes(document.status || "")
      ? document.status
      : defaultRequestStatus,
    estimatedDeliveryDate: document.estimatedDeliveryDate || "",
    startDate: document.startDate || "",
    endDate: document.endDate || "",
    estimatedJourneys: Number(document.estimatedJourneys) || 0,
    description: document.description || "",
    collectionId: document.collectionId || "",
    notes: notes.map(normalizeNoteDocument),
    tasks: tasks.map((task) => normalizeTaskDocument(task, context)),
    checklist: normalizeChecklist(document.checklist),
    journeys: normalizeJourneyPeriods(
      journeys,
      document.startDate || "",
      document.endDate || "",
    ),
    specification: normalizeSpecification(specification),
    attachments: Array.isArray(document.attachments)
      ? document.attachments
      : [],
    ...context,
    listRank: requestListRank(document),
    createdAt: document.createdAt || null,
    updatedAt: document.updatedAt || null,
  };
}

type RequestNormalizationRest = [
  journeys?: unknown,
  specification?: unknown,
  notes?: NoteDocument[],
  tasks?: TaskDocument[],
];
export function normalizeRequestDocument(
  document: RequestDocument,
  ...rest: RequestNormalizationRest
): NonNullable<ReturnType<typeof normalizeRequestDocumentValue>>;
export function normalizeRequestDocument(
  document: RequestDocument | null | undefined,
  ...rest: RequestNormalizationRest
): ReturnType<typeof normalizeRequestDocumentValue>;
export function normalizeRequestDocument(
  document: RequestDocument | null | undefined,
  ...rest: RequestNormalizationRest
) {
  return normalizeRequestDocumentValue(document, ...rest);
}
