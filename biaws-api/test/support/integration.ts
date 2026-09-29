import { randomUUID } from "node:crypto";
import net from "node:net";
import { TestContext } from "node:test";

export function isolatedDatabaseName() {
  return `biaws_test_${randomUUID().replaceAll("-", "")}`;
}

export function restoreEnvironmentAfter(testContext: TestContext) {
  const original = { ...process.env };
  testContext.after(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in original)) delete process.env[key];
    }
    Object.assign(process.env, original);
  });
}

export async function availablePort() {
  const reservation = net.createServer();
  await new Promise<void>((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", () => resolve());
  });
  const address = reservation.address();
  if (!address || typeof address === "string")
    throw new Error("Port reservation has no TCP address");
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    reservation.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}
