import { createRoot } from "react-dom/client";
import { configureApiSession } from "../../src/api/client.js";
import { MessagesProvider } from "../../src/infrastructure/messages/MessagesProvider.jsx";
import { useCatalogView } from "../../src/components/catalog/CatalogView/hooks/useCatalogView.js";
import { MarkdownPreview } from "../../src/components/shared/MarkdownEditor/index.jsx";

export { act } from "react";
export { navigate } from "../../src/navigation/location.js";

function CatalogSelection({ actor }) {
  const { dialog, error, selectedId } = useCatalogView(actor);
  return <output>{JSON.stringify({ entity: dialog?.entity, error, selectedId })}</output>;
}

export function mountResourceLinks(element, { actor, markdown }) {
  const disconnect = configureApiSession({ getWorkspaceId: () => actor?.workspaceId || "" });
  const root = createRoot(element);
  root.render(
    <MessagesProvider>
      {markdown !== undefined ? <MarkdownPreview value={markdown} /> : <CatalogSelection actor={actor} />}
    </MessagesProvider>,
  );
  return { root, disconnect };
}
