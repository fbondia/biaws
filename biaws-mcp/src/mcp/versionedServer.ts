import { McpServer, type Transport } from "@modelcontextprotocol/server";

// Legacy requests have no version envelope. Observe the SDK's negotiated
// transport version without depending on its deprecated session accessor.
export class VersionedMcpServer extends McpServer {
  protocolVersion?: string;

  override async connect(transport: Transport): Promise<void> {
    const setProtocolVersion = transport.setProtocolVersion?.bind(transport);
    transport.setProtocolVersion = (version) => {
      this.protocolVersion = version;
      setProtocolVersion?.(version);
    };
    await super.connect(transport);
  }
}
