export function dialogKeyboardAction(key) {
  if (key === "Escape") return "cancel";
  if (key === "Tab") return "contain-focus";
  return null;
}
