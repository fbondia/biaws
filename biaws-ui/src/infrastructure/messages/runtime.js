import { defineMessagesAdapter } from "./contract.js";
import { createMessagesService } from "./service.js";

export const defaultMessagesService = createMessagesService();

export const defaultMessagesBootstrapAdapter = defineMessagesAdapter({
  dispose: () => defaultMessagesService.dispose(),
});
