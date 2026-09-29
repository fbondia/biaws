function withDateType(filter, datePath) {
  const existingDateFilter = filter[datePath];

  return {
    ...filter,
    [datePath]: {
      ...(existingDateFilter &&
      typeof existingDateFilter === "object" &&
      !Array.isArray(existingDateFilter)
        ? existingDateFilter
        : {}),
      $type: "date",
    },
  };
}

function normalizeBucket(bucket, fallbackLabel = "sem valor") {
  return {
    key: bucket._id ?? fallbackLabel,
    count: bucket.count,
  };
}

function normalizeDateBucket(bucket, interval) {
  if (interval === "week" && bucket._id?.year && bucket._id?.week) {
    return {
      key: `${bucket._id.year}-W${String(bucket._id.week).padStart(2, "0")}`,
      count: bucket.count,
    };
  }

  return normalizeBucket(bucket);
}

function normalizeDateFieldBucket(bucket) {
  return {
    key: bucket._id ?? "sem valor",
    count: bucket.count,
    ...Object.fromEntries(
      (bucket.fields || []).map((field) => [
        field.key ?? "sem valor",
        field.count,
      ]),
    ),
  };
}

function normalizeTaxonomyBucket(bucket) {
  return {
    ...normalizeBucket(bucket),
    issues: (bucket.issues || []).map((issue) => ({
      id: issue.id,
      title: issue.title,
      type: issue.type,
      status: issue.status,
      date: issue.date,
    })),
  };
}

export async function aggregateByField(collection, filter, fieldName) {
  const rows = await collection
    .aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            $ifNull: [`$${fieldName}`, "sem valor"],
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ])
    .toArray();

  return rows.map(normalizeBucket);
}

export async function aggregateByTaxonomy(collection, filter, options = {}) {
  const datePath = options.datePath || "dates.receivedEmailAt";
  const rows = await collection
    .aggregate([
      {
        $match: {
          ...filter,
          "classification.primaryTaxonomyId": { $type: "string", $ne: "" },
        },
      },
      { $sort: { [datePath]: -1, _id: 1 } },
      {
        $group: {
          _id: "$classification.primaryTaxonomyId",
          count: { $sum: 1 },
          issues: {
            $push: {
              id: "$id",
              title: "$title",
              type: "$type",
              status: "$status",
              date: `$${datePath}`,
            },
          },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ])
    .toArray();

  return rows.map(normalizeTaxonomyBucket);
}

export async function aggregateByDate(collection, filter, options) {
  if (options.interval === "week") {
    const rows = await collection
      .aggregate([
        { $match: withDateType(filter, options.datePath) },
        {
          $group: {
            _id: {
              year: {
                $isoWeekYear: {
                  date: `$${options.datePath}`,
                  timezone: options.timezone,
                },
              },
              week: {
                $isoWeek: {
                  date: `$${options.datePath}`,
                  timezone: options.timezone,
                },
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.week": 1 } },
      ])
      .toArray();

    return rows.map((row) => normalizeDateBucket(row, options.interval));
  }

  const rows = await collection
    .aggregate([
      { $match: withDateType(filter, options.datePath) },
      {
        $group: {
          _id: {
            $dateToString: {
              format: options.dateFormat,
              date: `$${options.datePath}`,
              timezone: options.timezone,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  return rows.map((row) => normalizeDateBucket(row, options.interval));
}

export async function aggregateByDateAndField(
  collection,
  filter,
  options,
  fieldName,
) {
  const rows = await collection
    .aggregate([
      { $match: withDateType(filter, options.datePath) },
      {
        $group: {
          _id: {
            bucket: {
              $dateToString: {
                format: options.dateFormat,
                date: `$${options.datePath}`,
                timezone: options.timezone,
              },
            },
            field: {
              $ifNull: [`$${fieldName}`, "sem valor"],
            },
          },
          count: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: "$_id.bucket",
          count: { $sum: "$count" },
          fields: {
            $push: {
              key: "$_id.field",
              count: "$count",
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ])
    .toArray();

  return rows.map(normalizeDateFieldBucket);
}
