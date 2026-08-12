export const COLLECTION_NAVIGATION_MIN_WIDTH = 260;
export const COLLECTION_NAVIGATION_MAX_WIDTH = 600;
export const COLLECTION_DETAIL_MIN_WIDTH = 420;

export function clampedNavigationWidth(width, bodyWidth) {
  const availableWidth = bodyWidth
    ? bodyWidth - COLLECTION_DETAIL_MIN_WIDTH - 8
    : COLLECTION_NAVIGATION_MAX_WIDTH;
  const maximumWidth = Math.max(
    COLLECTION_NAVIGATION_MIN_WIDTH,
    Math.min(COLLECTION_NAVIGATION_MAX_WIDTH, availableWidth),
  );
  return Math.min(
    maximumWidth,
    Math.max(COLLECTION_NAVIGATION_MIN_WIDTH, width),
  );
}
