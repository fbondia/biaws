import {
  COLLECTION_NAVIGATION_MAX_WIDTH,
  COLLECTION_NAVIGATION_MIN_WIDTH,
} from "../model.js";

export function ResourceCollectionsResizer({
  clampWidth,
  navigationWidth,
  resizeNavigation,
  resizingNavigation,
  setNavigationWidth,
  setResizingNavigation,
}) {
  return (
    <div
      aria-label="Redimensionar área de navegação"
      aria-orientation="vertical"
      aria-valuemax={COLLECTION_NAVIGATION_MAX_WIDTH}
      aria-valuemin={COLLECTION_NAVIGATION_MIN_WIDTH}
      aria-valuenow={navigationWidth}
      className={[
        "resourceCollectionsResizer",
        resizingNavigation ? "resourceCollectionsResizing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onKeyDown={(event) => {
        let nextWidth;
        if (event.key === "ArrowLeft") nextWidth = navigationWidth - 20;
        if (event.key === "ArrowRight") nextWidth = navigationWidth + 20;
        if (event.key === "Home") nextWidth = COLLECTION_NAVIGATION_MIN_WIDTH;
        if (event.key === "End") nextWidth = COLLECTION_NAVIGATION_MAX_WIDTH;
        if (nextWidth === undefined) return;
        event.preventDefault();
        setNavigationWidth(clampWidth(nextWidth));
      }}
      onLostPointerCapture={() => setResizingNavigation(false)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setResizingNavigation(true);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        resizeNavigation(event.clientX);
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setResizingNavigation(false);
      }}
      role="separator"
      tabIndex={0}
      title="Arraste para redimensionar a área de navegação"
    />
  );
}
