import { MarkerType } from "@xyflow/react";

export function edgeDirectionMarkers(direction = "forward") {
  const marker = { type: MarkerType.ArrowClosed };
  return {
    markerStart:
      direction === "reverse" || direction === "both" ? marker : undefined,
    markerEnd:
      direction === "forward" || direction === "both" ? marker : undefined,
  };
}

export function diagramSummary(diagram) {
  return {
    id: diagram.id,
    name: diagram.name,
    environment: diagram.environment,
    updatedAt: diagram.updatedAt,
    updatedBy: diagram.updatedBy,
  };
}
