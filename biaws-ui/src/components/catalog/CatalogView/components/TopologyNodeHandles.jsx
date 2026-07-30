import { Handle, Position } from "@xyflow/react";

const handles = [
  { id: "top-left", position: Position.Top, style: { left: 10 } },
  { id: "top", position: Position.Top, style: { left: "50%" } },
  {
    id: "top-right",
    position: Position.Top,
    style: { left: "calc(100% - 10px)" },
  },
  {
    id: "right",
    position: Position.Right,
    style: { top: "50%" },
  },
  {
    id: "bottom-right",
    position: Position.Bottom,
    style: { left: "calc(100% - 10px)" },
  },
  {
    id: "bottom",
    position: Position.Bottom,
    style: { left: "50%" },
  },
  {
    id: "bottom-left",
    position: Position.Bottom,
    style: { left: 10 },
  },
  {
    id: "left",
    position: Position.Left,
    style: { top: "50%" },
  },
];

export function TopologyNodeHandles() {
  return handles.map(({ id, position, style }) => (
    <Handle
      className="topologyNodeHandle"
      id={id}
      key={id}
      position={position}
      style={style}
      type="source"
    />
  ));
}
