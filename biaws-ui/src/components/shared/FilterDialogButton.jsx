export function FilterDialogButton({
  className = "",
  count = 0,
  disabled = false,
  icon: Icon,
  label,
  onClick,
  summary,
}) {
  return (
    <button
      className={["secondaryButton", "filterDialogTriggerButton", className]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {Icon ? <Icon size={15} /> : null}
      <span className="filterDialogButtonText">
        <strong>{label}</strong>
        <small>{summary}</small>
      </span>
      {count ? <span className="filterDialogCount">{count}</span> : null}
    </button>
  );
}
