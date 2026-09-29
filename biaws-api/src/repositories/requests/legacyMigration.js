import { NOTES_COLLECTION, REQUESTS_COLLECTION } from "./constants.js";
import { readString, dateInputValue } from "./support.js";

export async function syncLegacyNotes(db, requestId, notes, now) {
  const notesCollection = db.collection(NOTES_COLLECTION);

  if (!notes || !notes.length) {
    await notesCollection.deleteMany({
      requestId,
      legacySource: "Request.notes",
    });
    return;
  }

  const [primaryNote] = notes;
  await notesCollection.updateOne(
    { requestId, legacySource: "Request.notes" },
    {
      $set: {
        requestId,
        legacySource: "Request.notes",
        date: primaryNote.date,
        content: primaryNote.content,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

export async function insertInitialNotes(db, requestId, notes, now) {
  if (!notes || !notes.length) return;

  await db.collection(NOTES_COLLECTION).insertMany(
    notes.map((note) => ({
      requestId,
      date: note.date,
      content: note.content,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

export async function migrateLegacyNotes(db, requests) {
  const requestsWithNotes = requests.filter((request) =>
    readString(request.notes).trim(),
  );
  if (!requestsWithNotes.length) return;

  const now = new Date();
  const requestIds = requestsWithNotes.map((request) => request._id);
  const existingNotes = await db
    .collection(NOTES_COLLECTION)
    .find({ requestId: { $in: requestIds }, legacySource: "Request.notes" })
    .toArray();
  const existingByRequestId = new Map(
    existingNotes.map((note) => [
      note.requestId?.toString?.() ?? String(note.requestId),
      note,
    ]),
  );
  const operations = [];

  for (const request of requestsWithNotes) {
    const requestIdKey = request._id.toString();
    const existingNote = existingByRequestId.get(requestIdKey);
    const nextNote = {
      requestId: request._id,
      legacySource: "Request.notes",
      date: dateInputValue(request.updatedAt || request.createdAt || now),
      content: readString(request.notes).trim(),
    };

    if (!existingNote) {
      operations.push({
        insertOne: {
          document: {
            ...nextNote,
            createdAt: now,
            updatedAt: now,
          },
        },
      });
      continue;
    }

    if (
      existingNote.date !== nextNote.date ||
      existingNote.content !== nextNote.content
    ) {
      operations.push({
        updateOne: {
          filter: { _id: existingNote._id },
          update: {
            $set: {
              date: nextNote.date,
              content: nextNote.content,
              updatedAt: now,
            },
          },
        },
      });
    }
  }

  if (operations.length) {
    await db.collection(NOTES_COLLECTION).bulkWrite(operations);
  }

  await db.collection(REQUESTS_COLLECTION).updateMany(
    { _id: { $in: requestIds } },
    {
      $unset: {
        notes: "",
      },
    },
  );
}
