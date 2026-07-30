import { Box } from "lucide-react";
import { memo } from "react";

import { TopologyNodeHandles } from "./TopologyNodeHandles.jsx";

function contrastingTextColor(backgroundColor) {
  const color = /^#[0-9a-f]{6}$/iu.test(backgroundColor)
    ? backgroundColor.slice(1)
    : "edf9f5";
  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 255000;
  return luminance > 0.62 ? "#17352e" : "#ffffff";
}

export const TopologyElementNode = memo(function TopologyElementNode({ data }) {
  const headerColor = data.element.headerColor || "#edf9f5";
  const textColor = contrastingTextColor(headerColor);

  return (
    <article className="topologyElementNode">
      <TopologyNodeHandles />
      <header style={{ backgroundColor: headerColor }}>
        <span style={{ color: textColor }}>
          <Box size={16} />
          {data.element.type || "Elemento"}
        </span>
      </header>
      <div>
        <strong>{data.element.title}</strong>
        {data.element.description ? (
          <small>{data.element.description}</small>
        ) : null}
      </div>
    </article>
  );
});
