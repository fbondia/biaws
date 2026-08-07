export function IllustratedEmptyState({
  className = "",
  compact = false,
  description,
  icon: Icon,
  title,
}) {
  return (
    <div
      className={[
        "illustratedEmptyState",
        compact ? "compactIllustratedEmptyState" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
    >
      {Icon ? (
        <span className="illustratedEmptyStateIcon">
          <Icon aria-hidden="true" size={compact ? 20 : 28} />
        </span>
      ) : null}
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
