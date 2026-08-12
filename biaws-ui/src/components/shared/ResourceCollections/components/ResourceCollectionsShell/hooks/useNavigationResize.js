import { useRef, useState } from "react";

import { clampedNavigationWidth } from "../model.js";

export function useNavigationResize(initialNavigationWidth) {
  const bodyRef = useRef(null);
  const [navigationWidth, setNavigationWidth] = useState(
    initialNavigationWidth,
  );
  const [resizingNavigation, setResizingNavigation] = useState(false);

  function clampWidth(width) {
    return clampedNavigationWidth(
      width,
      bodyRef.current?.getBoundingClientRect().width,
    );
  }

  function resizeNavigation(clientX) {
    const bodyLeft = bodyRef.current?.getBoundingClientRect().left;
    if (bodyLeft === undefined) return;
    setNavigationWidth(clampWidth(clientX - bodyLeft));
  }

  return {
    bodyRef,
    clampWidth,
    navigationWidth,
    resizeNavigation,
    resizingNavigation,
    setNavigationWidth,
    setResizingNavigation,
  };
}
