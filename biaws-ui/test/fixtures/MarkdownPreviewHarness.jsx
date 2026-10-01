import { createRoot } from "react-dom/client";

import { MarkdownPreview } from "../../src/components/shared/MarkdownEditor/index.jsx";

export function mountMarkdownPreview(element, value, props = {}) {
  const root = createRoot(element);
  root.render(<MarkdownPreview {...props} value={value} />);
  return {
    root,
    update: (nextValue, nextProps = props) => root.render(<MarkdownPreview {...nextProps} value={nextValue} />),
  };
}
