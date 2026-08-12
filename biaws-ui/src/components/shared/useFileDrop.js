import { useEffect, useRef, useState } from "react";

function isFileDrag(event) {
  return [...(event.dataTransfer?.types || [])].includes("Files");
}

export function useFileDrop({ disabled = false, onDropFiles }) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepth = useRef(0);

  useEffect(() => {
    if (!disabled) return;
    dragDepth.current = 0;
    setIsDraggingFiles(false);
  }, [disabled]);

  function onDragEnter(event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (disabled) return;
    dragDepth.current += 1;
    setIsDraggingFiles(true);
  }

  function onDragLeave(event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (!dragDepth.current) setIsDraggingFiles(false);
  }

  function onDragOver(event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = disabled ? "none" : "copy";
    }
  }

  function onDrop(event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current = 0;
    setIsDraggingFiles(false);
    if (disabled) return;
    void onDropFiles(
      [...(event.dataTransfer?.files || [])],
      event.dataTransfer,
    );
  }

  return {
    isDraggingFiles,
    dropTargetProps: {
      onDragEnter,
      onDragLeave,
      onDragOver,
      onDrop,
    },
  };
}
