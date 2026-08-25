import { createRoot } from "react-dom/client";

import { MarkdownPreview } from "../../src/components/shared/MarkdownEditor/index.jsx";

export function mountMarkdownPreview(element, value) {
  const root = createRoot(element);
  root.render(<MarkdownPreview value={value} />);
  return { root };
}
