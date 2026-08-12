import { useEffect, useState } from "react";

import { useResourceCollectionsShell } from "../ResourceCollectionsShellContext.js";

export function useRootCollectionDrop() {
  const shell = useResourceCollectionsShell();
  const [active, setActive] = useState(false);
  const draggedItem = shell?.draggedItem;
  const enabled = Boolean(
    draggedItem && shell?.onDropRoot && shell.canDropRoot?.(draggedItem),
  );

  useEffect(() => {
    if (!enabled) setActive(false);
  }, [enabled]);

  return {
    active,
    enabled,
    dropProps: {
      onDragLeave(event) {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setActive(false);
        }
      },
      onDragOver(event) {
        if (!enabled) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setActive(true);
      },
      onDrop(event) {
        if (!enabled) return;
        event.preventDefault();
        setActive(false);
        shell.onDropRoot();
      },
    },
  };
}
