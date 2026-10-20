import { useState } from "react";
import { createRoot } from "react-dom/client";
import { configureApiSession } from "../../src/api/client.js";
import { MarkdownEditor } from "../../src/components/shared/MarkdownEditor/index.jsx";
import { SessionProvider } from "../../src/infrastructure/session/SessionProvider.jsx";
import { MessagesProvider } from "../../src/infrastructure/messages/MessagesProvider.jsx";
import "../../src/styles.css";

export { act } from "react";

export function mountDocumentLinkEditor(element, initialValue, actor, props = {}) {
  let state = { status: "authenticated", actor };
  const listeners = new Set();
  const service = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const disconnect = configureApiSession({ getWorkspaceId: () => state.actor?.workspaceId || "" });
  const root = createRoot(element);
  function Harness() {
    const [value, setValue] = useState(initialValue);
    return (
      <SessionProvider service={service}>
        <MessagesProvider>
          <MarkdownEditor initialMode="text" {...props} value={value} onChange={setValue} />
        </MessagesProvider>
      </SessionProvider>
    );
  }
  root.render(<Harness />);
  return {
    root,
    disconnect,
    setActor(actor) {
      state = { status: "authenticated", actor };
      for (const listener of listeners) listener();
    },
  };
}
