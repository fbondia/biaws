import { createRoot } from "react-dom/client";

import { MarkdownPreview } from "../../src/components/shared/MarkdownEditor/index.jsx";
import { MessagesProvider } from "../../src/infrastructure/messages/MessagesProvider.jsx";
import { createMessagesService } from "../../src/infrastructure/messages/service.js";

export { act } from "react";

export function mountMarkdownPreview(element, value, props = {}) {
  const root = createRoot(element);
  const service = createMessagesService();
  const render = (value, props) =>
    root.render(
      <MessagesProvider service={service}>
        <MarkdownPreview {...props} value={value} />
      </MessagesProvider>,
    );
  render(value, props);
  return {
    root,
    update: (nextValue, nextProps = props) => render(nextValue, nextProps),
    dispose: service.dispose,
  };
}
