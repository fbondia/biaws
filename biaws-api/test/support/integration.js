import { randomUUID } from "node:crypto";
import net from "node:net";

export function isolatedDatabaseName() {
  return `biaws_test_${randomUUID().replaceAll("-", "")}`;
}

export function restoreEnvironmentAfter(testContext) {
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
  await new Promise((resolve, reject) => {
    reservation.once("error", reject);
    reservation.listen(0, "127.0.0.1", resolve);
  });
  const port = reservation.address().port;
  await new Promise((resolve, reject) => {
    reservation.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}
