import assert from "node:assert/strict";
import test from "node:test";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";

test("CIMD transport rejects HTTP and non-public DNS/IP targets before connecting", async () => {
  await assert.rejects(async () => fetchClientMetadataResource("http://127.0.0.1/client.json"), /HTTPS/);
  for (const url of [
    "https://127.0.0.1/client.json",
    "https://192.168.0.1/client.json",
    "https://169.254.169.254/latest/meta-data",
  ]) {
    await assert.rejects(async () => fetchClientMetadataResource(url), /public-routable/);
  }
});
