export function ResourceCollectionBarLeft({
  archivedItemsTargetRef,
  collectionFilterTargetRef,
  viewModeTargetRef,
}) {
  return (
    <div
      aria-label="Opções de visualização"
      className="resourceCollectionBarPrimary"
      role="group"
    >
      <div
        className="resourceCollectionBarActionSlot"
        ref={viewModeTargetRef}
      />
      <div
        className="resourceCollectionBarActionSlot"
        ref={collectionFilterTargetRef}
      />
      <div
        className="resourceCollectionBarActionSlot"
        ref={archivedItemsTargetRef}
      />
    </div>
  );
}
