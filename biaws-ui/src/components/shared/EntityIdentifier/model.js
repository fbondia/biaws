export async function copyIdentifier(value) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(String(value));
    return true;
  }
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = String(value);
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}
