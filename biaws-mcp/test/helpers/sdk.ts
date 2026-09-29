import { Client, type ClientOptions } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createBiawsMcpServer, type McpOptions } from "../../src/mcpServer.js";

export async function connectTestServer(
  options: McpOptions = {},
  clientOptions: ClientOptions = {},
) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  let instance: ReturnType<typeof createBiawsMcpServer> | undefined;
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
      await instance?.waitForIdle();
    },
  };
}
