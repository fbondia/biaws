import http from "node:http";
import https from "node:https";

function collectResponse(response, byteLimit, signal) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let stored = 0;
    let total = 0;
    let truncated = false;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({
        body: Buffer.concat(chunks).toString("utf8"),
        bytes: total,
        truncated,
      });
    };
    response.on("data", (rawChunk) => {
      const chunk = Buffer.isBuffer(rawChunk)
        ? rawChunk
        : Buffer.from(rawChunk);
      total += chunk.length;
      if (stored < byteLimit) {
        const part = chunk.subarray(0, byteLimit - stored);
        chunks.push(part);
        stored += part.length;
      }
      if (total > byteLimit) {
        truncated = true;
        response.destroy();
        finish();
      }
    });
    response.on("end", finish);
    response.on("error", (error) => {
      if (!settled) reject(error);
    });
    signal?.addEventListener(
      "abort",
      () => {
        if (!settled) reject(signal.reason);
      },
      { once: true },
    );
  });
}

export async function requestRestTarget(
  url,
  configuration,
  headers,
  destination,
  policy,
  signal,
) {
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: configuration.method,
        headers,
        signal,
        lookup: (_hostname, _options, callback) =>
          callback(null, destination.address, destination.family),
        agent: false,
      },
      async (response) => {
        try {
          resolve({
            response,
            evidence: await collectResponse(
              response,
              policy.maxEvidenceBytes,
              signal,
            ),
          });
        } catch (error) {
          reject(error);
        }
      },
    );
    request.on("error", reject);
    if (configuration.body) request.write(configuration.body);
    request.end();
  });
}
