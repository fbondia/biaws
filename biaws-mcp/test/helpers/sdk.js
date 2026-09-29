import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createBiawsMcpServer } from "../../src/mcpServer.js";

export async function connectTestServer(options = {}, clientOptions = {}) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  let instance;
  const handle = serveStdio(
    ({ era }) => {
      instance = createBiawsMcpServer({ ...options, era });
      return instance.server;
    },
    { transport: serverTransport },
  );
  const client = new Client(
    { name: "biaws-test", version: "1.0.0" },
    clientOptions,
  );
  await client.connect(clientTransport);
  return {
    client,
    async close() {
      await client.close();
      await handle.close();
      await instance.waitForIdle();
    },
  };
}
